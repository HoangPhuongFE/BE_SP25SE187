import { PrismaClient, User } from '@prisma/client';
import HTTP_STATUS from '../constants/httpStatus';

const prisma = new PrismaClient();

interface ThesisGuidanceQuery {
  semesterId?: string;
  submissionPeriodId?: string;
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
}

interface ThesisGuidanceResponse {
  success: boolean;
  status: number;
  data: FormattedThesis[];
  message?: string;
}

export class ThesisAssignmentService {
  async getThesisGuidanceList(query: ThesisGuidanceQuery): Promise<ThesisGuidanceResponse> {
    try {
      const { semesterId, submissionPeriodId } = query;

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
          topic: true, // Lấy đủ để có topic.mainSupervisor (kiểu string)
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

      // Tập hợp danh sách ID giảng viên hướng dẫn
      const supervisorIds = Array.from(
        new Set(
          thesisAssignments.map(a => a.topic?.mainSupervisor).filter((id): id is string => id !== null && id !== undefined)
        )
      );

      // Truy vấn thông tin giảng viên hướng dẫn
      const supervisors = await prisma.user.findMany({
        where: { id: { in: supervisorIds } },
      });

      const supervisorMap: Record<string, User> = {};
      supervisors.forEach(user => {
        supervisorMap[user.id] = user;
      });

      // Xử lý dữ liệu đầu ra
      const formattedTheses: FormattedThesis[] = thesisAssignments
        .flatMap((assignment) => {
          const topic = assignment.topic;
          const group = assignment.group;

          if (!group || !group.members || group.members.length === 0) return [];

          return group.members.map((member) => {
            const student = member.student;
            if (!student || !student.user) return null;

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

      return {
        success: true,
        status: HTTP_STATUS.OK,
        data: formattedTheses,
        message: formattedTheses.length === 0 ? 'No approved thesis assignments found.' : undefined,
      };

    } catch (error) {
      console.error('Error retrieving thesis guidance list:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, data: [], message: 'System error!' };
    }
  }
}
