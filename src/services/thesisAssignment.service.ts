import { PrismaClient, User } from '@prisma/client';
import HTTP_STATUS from '../constants/httpStatus';
import { AIService } from './ai.service';

const prisma = new PrismaClient();

interface ThesisGuidanceQuery {
  semesterId?: string;
  submissionPeriodId?: string;
  includeAI?: boolean;
}

interface FormattedThesis {
  stt: number;
  mssv: string;
  studentName: string;
  groupCode: string;
  topicCode: string;
  topicNameEnglish: string;
  topicNameVietnamese: string;
  mentor: string;
  major: string;
  aiStatus?: string;
  confidence?: number;
  aiMessage?: string;
}

interface ThesisGuidanceResponse {
  success: boolean;
  status: number;
  data: FormattedThesis[];
  message?: string;
}

export class ThesisAssignmentService {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
  }

  async getThesisGuidanceList(query: ThesisGuidanceQuery): Promise<ThesisGuidanceResponse> {
    try {
      const { semesterId, submissionPeriodId, includeAI } = query;

      const thesisAssignments = await prisma.topicAssignment.findMany({
        where: {
          approvalStatus: 'APPROVED',
          topic: {
            semesterId,
            submissionPeriodId,
            isDeleted: false,
          },
        },
        include: {
          topic: true,
          group: {
            include: {
              members: {
                include: {
                  student: {
                    include: {
                      major: true,
                      user: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          assignedAt: 'asc',
        },
      });

      const supervisorIds = Array.from(
        new Set(
          thesisAssignments.map(a => a.topic?.mainSupervisor).filter((id): id is string => !!id)
        )
      );

      const supervisors = await prisma.user.findMany({
        where: { id: { in: supervisorIds } },
      });

      const supervisorMap: Record<string, User> = {};
      supervisors.forEach(user => {
        supervisorMap[user.id] = user;
      });

      const formattedTheses = thesisAssignments
        .flatMap((assignment) => {
          const topic = assignment.topic;
          const group = assignment.group;
          if (!group?.members?.length) return [];

          return group.members.map((member) => {
            const student = member.student;
            if (!student?.user) return null;

            const mentor = topic.mainSupervisor ? supervisorMap[topic.mainSupervisor] : null;

            return {
              mssv: student.user.student_code || 'N/A',
              studentName: student.user.username || 'N/A',
              groupCode: group.groupCode || 'N/A',
              topicCode: topic.topicCode || 'N/A',
              topicNameEnglish: topic.nameEn || 'N/A',
              topicNameVietnamese: topic.nameVi || 'N/A',
              mentor: mentor?.username || 'N/A',
              major: student.major?.name || 'N/A',
            };
          }).filter((item): item is Omit<FormattedThesis, 'stt'> => item !== null);
        })
        .map((item, idx) => ({ ...item, stt: idx + 1 }));

      // Gọi AI kiểm tra nếu có yêu cầu
      let enhancedTheses = formattedTheses;

      if (includeAI) {
        const items = formattedTheses.map((item) => ({
          topicCode: item.topicCode,
          groupCode: item.groupCode,
          nameVi: item.topicNameVietnamese,
          nameEn: item.topicNameEnglish,
          mentorUsername: item.mentor,
        }));

        const verifyResults = await this.aiService.batchVerifyDecision(items, 'AI_System');

        const resultMap = new Map<string, any>();
        verifyResults.forEach(r => resultMap.set(r.topicCode, r));

        enhancedTheses = formattedTheses.map(item => {
          const ai = resultMap.get(item.topicCode);
          return {
            ...item,
            aiStatus: ai?.isConsistent ? 'Passed' : 'Failed',
            confidence: ai?.confidence ?? 0,
            aiMessage: ai?.issues?.join(', ') ?? '',
          };
        });
      }

      return {
        success: true,
        status: HTTP_STATUS.OK,
        data: enhancedTheses,
        message: enhancedTheses.length === 0 ? 'Không có đề tài nào được duyệt.' : undefined,
      };
    } catch (error) {
      console.error('Error retrieving thesis guidance list:', error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        data: [],
        message: 'System error!',
      };
    }
  }
}
