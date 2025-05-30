import { PrismaClient } from '@prisma/client';
import HTTP_STATUS from '../constants/httpStatus';
import COUNCIL_MESSAGE from '../constants/message';
import { SubmissionPeriodService } from './submissionPeriod.service';
import { SystemConfigService } from './system.config.service';
import { nowVN } from '../utils/date'; 
const submissionPeriodService = new SubmissionPeriodService();
const prisma = new PrismaClient();
const systemConfigService = new SystemConfigService();

export class CouncilTopicService {
  async createCouncil(data: {
  name: string;
  semesterId: string;
  submissionPeriodId?: string;
  relatedSubmissionPeriodId?: string;
  createdBy: string;
  startDate: Date;
  endDate: Date;
  status?: string;
  type?: string;
  round?: number;
}) {
  try {
    const creator = await prisma.user.findUnique({
      where: { id: data.createdBy },
      include: { roles: { include: { role: true } } },
    });
    if (!creator) {
      return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Người tạo không tồn tại!" };
    }
    const creatorRoles = creator.roles.map(r => r.role.name.toLowerCase());
    if (creatorRoles.includes("academic_officer")) {
      return { success: false, status: HTTP_STATUS.FORBIDDEN, message: "Academic officer không được phép tạo hội đồng." };
    }

    const semester = await prisma.semester.findUnique({ where: { id: data.semesterId } });
    if (!semester) {
      return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Học kỳ không tồn tại!" };
    }

    if (data.submissionPeriodId) {
      const submissionPeriod = await prisma.submissionPeriod.findUnique({
        where: { id: data.submissionPeriodId },
      });
      if (!submissionPeriod) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Đợt xét duyệt không tồn tại!" };
      }
    }

    if (data.relatedSubmissionPeriodId) {
      const relatedSubmissionPeriod = await prisma.submissionPeriod.findUnique({
        where: { id: data.relatedSubmissionPeriodId },
      });
      if (!relatedSubmissionPeriod) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Đợt xét duyệt liên quan không tồn tại!" };
      }
      if (relatedSubmissionPeriod.type !== "TOPIC") {
        return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: "Đợt xét duyệt liên quan phải là loại TOPIC!" };
      }
    }

    if (data.startDate >= data.endDate) {
      return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: "Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc." };
    }

    const now = nowVN(); // Sửa: Dùng nowVN()
    let computedStatus = data.status || "ACTIVE";
    if (now < data.startDate) computedStatus = "UPCOMING";
    else if (now >= data.startDate && now <= data.endDate) computedStatus = "ACTIVE";
    else computedStatus = "COMPLETE";

    const prefix = `${(data.type || "CHECK-TOPIC").toUpperCase()}-${data.round || 1}-${semester.code}`;
    const count = await prisma.council.count({ where: { code: { startsWith: prefix } } });
    const sequenceNumber = (count + 1).toString().padStart(3, "0");
    const councilCode = `${prefix}-${sequenceNumber}`;

    const existingCouncil = await prisma.council.findUnique({ where: { code: councilCode } });
    if (existingCouncil) {
      return { success: false, status: HTTP_STATUS.CONFLICT, message: "Mã hội đồng đã tồn tại. Vui lòng kiểm tra lại thông tin hoặc thay đổi round/type để tạo mã mới." };
    }

    const newCouncil = await prisma.council.create({
      data: {
        name: data.name,
        semesterId: data.semesterId,
        submissionPeriodId: data.submissionPeriodId || null,
        relatedSubmissionPeriodId: data.relatedSubmissionPeriodId || null,
        councilStartDate: data.startDate,
        councilEndDate: data.endDate,
        status: computedStatus,
        type: data.type || "CHECK-TOPIC",
        round: data.round || 1,
        createdDate: nowVN(), // Sửa: Dùng nowVN()
        code: councilCode,
      },
    });

    return { success: true, status: HTTP_STATUS.CREATED, message: "Tạo hội đồng thành công!", data: newCouncil };
  } catch (error: any) {
    console.error("Lỗi khi tạo hội đồng:", error);
    if (error.code === "P2002" && error.meta?.target.includes("councils_council_code_key")) {
      return { success: false, status: HTTP_STATUS.CONFLICT, message: "Mã hội đồng trùng lặp, vui lòng kiểm tra lại thông tin." };
    }
    return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống khi tạo hội đồng." };
  }
}

  async updateTopicCouncil(councilId: string, data: {
  name?: string;
  code?: string;
  round?: number;
  status?: string;
  councilStartDate?: Date;
  councilEndDate?: Date;
  relatedSubmissionPeriodId?: string;
}) {
  try {
    let updateData: any = { ...data };
    if (data.councilStartDate && data.councilEndDate) {
      const now = nowVN(); // Sửa: Dùng nowVN()
      let computedStatus = data.status || "ACTIVE";
      if (now < data.councilStartDate) computedStatus = "UPCOMING";
      else if (now >= data.councilStartDate && now <= data.councilEndDate) computedStatus = "ACTIVE";
      else computedStatus = "COMPLETE";
      updateData.status = computedStatus;
    }

    if (data.relatedSubmissionPeriodId) {
      const relatedSubmissionPeriod = await prisma.submissionPeriod.findUnique({
        where: { id: data.relatedSubmissionPeriodId },
      });
      if (!relatedSubmissionPeriod) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Đợt xét duyệt liên quan không tồn tại!" };
      }
      if (relatedSubmissionPeriod.type !== "TOPIC") {
        return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: "Đợt xét duyệt liên quan phải là loại TOPIC!" };
      }
      updateData.relatedSubmissionPeriodId = data.relatedSubmissionPeriodId;
    }

    const updatedCouncil = await prisma.council.update({
      where: { id: councilId },
      data: updateData,
    });

    return { success: true, status: HTTP_STATUS.OK, message: COUNCIL_MESSAGE.COUNCIL_UPDATED, data: updatedCouncil };
  } catch (error) {
    console.error("Lỗi khi cập nhật hội đồng topic:", error);
    return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: COUNCIL_MESSAGE.COUNCIL_UPDATE_FAILED };
  }
}

  async getTopicCouncils(filter: {
    semesterId?: string;
    submissionPeriodId?: string;
    round?: number;
    user?: { userId: string; roles: { name: string; semesterId?: string | null }[] };
  }) {
    try {
      const { semesterId, submissionPeriodId, round, user } = filter;
      let whereClause: any = {
        type: "CHECK-TOPIC",
        ...(semesterId && { semesterId }),
        ...(submissionPeriodId && { submissionPeriodId }),
        ...(round !== undefined && { round }),
      };

      if (user && user.roles.some((role) => role.name === "lecturer") && !user.roles.some((role) => ["examination_officer", "graduation_thesis_manager"].includes(role.name))) {
        whereClause = { ...whereClause, members: { some: { userId: user.userId } } };
      }

      const councils = await prisma.council.findMany({
        where: whereClause,
        include: { members: { include: { user: { select: { id: true, fullName: true, email: true, username: true } } } } },
      });

      const roleIds = councils.flatMap((council) => council.members.map((member) => member.roleId)).filter((id, index, self) => self.indexOf(id) === index);
      const roles = await prisma.role.findMany({ where: { id: { in: roleIds } }, select: { id: true, name: true } });
      const roleMap = new Map(roles.map((role) => [role.id, role.name]));

      const councilsWithRoleNames = councils.map((council) => ({
        ...council,
        members: council.members.map((member) => ({ ...member, roleName: roleMap.get(member.roleId) || "Không xác định" })),
      }));

      return { success: true, status: HTTP_STATUS.OK, message: COUNCIL_MESSAGE.COUNCIL_LIST_FETCHED, data: councilsWithRoleNames };
    } catch (error) {
      console.error("Lỗi khi lấy danh sách hội đồng topic:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: COUNCIL_MESSAGE.COUNCIL_LIST_FAILED };
    }
  }

  async getTopicCouncilById(councilId: string) {
    try {
      const council = await prisma.council.findUnique({
        where: { id: councilId },
        include: {
          members: { include: { user: { select: { id: true, fullName: true, email: true , username: true } } } },
          sessions: {
            include: {
              group: { select: { id: true, groupCode: true, semesterId: true, status: true } },
              topic: { select: { id: true, topicCode: true, name: true, status: true } },
              assignments: {
                include: {
                  council: { select: { id: true, name: true } },
                  topic: { select: { id: true, topicCode: true, name: true } },
                  reviewer: { select: { id: true, fullName: true, email: true , username: true } },
                  reviewSchedule: { select: { id: true, reviewTime: true, room: true, reviewRound: true, status: true, note: true } },
                },
              },
              documents: {
                where: { documentType: "REVIEW_REPORT", isDeleted: false },
                select: { id: true, fileName: true, fileUrl: true, documentType: true, uploadedAt: true, uploadedBy: true },
              },
            },
          },
        },
      });

      if (!council) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: COUNCIL_MESSAGE.COUNCIL_NOT_FOUND };
      }

      const roleIds = council.members.map(m => m.roleId);
      const roles = await prisma.role.findMany({ where: { id: { in: roleIds } }, select: { id: true, name: true } });
      const roleMap = new Map(roles.map(r => [r.id, r.name]));

      const result = council.sessions.map(schedule => ({
        schedule: {
          id: schedule.id,
          councilId: schedule.councilId,
          groupId: schedule.groupId,
          topicId: schedule.topicId,
          reviewTime: schedule.reviewTime,
          room: schedule.room,
          reviewRound: schedule.reviewRound,
          note: schedule.note,
          status: schedule.status,
          isDeleted: schedule.isDeleted,
          council: { id: council.id, code: council.code, name: council.name, status: council.status, type: council.type, round: council.round },
          group: schedule.group,
          topic: schedule.topic,
        },
        assignments: schedule.assignments.map(assignment => ({
          id: assignment.id,
          councilId: assignment.councilId,
          topicId: assignment.topicId,
          reviewerId: assignment.reviewerId,
          score: assignment.score,
          feedback: assignment.feedback,
          status: assignment.status,
          reviewRound: assignment.reviewRound,
          assignedAt: assignment.assignedAt,
          reviewedAt: assignment.reviewedAt,
          reviewScheduleId: assignment.reviewScheduleId,
          isDeleted: assignment.isDeleted,
          council: assignment.council,
          topic: assignment.topic,
          reviewer: assignment.reviewer,
          reviewSchedule: assignment.reviewSchedule,
        })),
        documents: schedule.documents,
      }));

      const councilWithRoleNames = {
        council: {
          id: council.id,
          code: council.code,
          name: council.name,
          status: council.status,
          type: council.type,
          round: council.round,
          members: council.members.map(member => ({ ...member, roleName: roleMap.get(member.roleId) || "Không xác định" })),
        },
        schedules: result,
      };

      return { success: true, status: HTTP_STATUS.OK, message: COUNCIL_MESSAGE.COUNCIL_FETCHED, data: councilWithRoleNames };
    } catch (error) {
      console.error("Lỗi khi lấy hội đồng xét duyệt:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: COUNCIL_MESSAGE.COUNCIL_LIST_FAILED };
    }
  }

  async addMemberToCouncil(councilId: string, data: { email: string; role: string; addedBy: string }) {
  try {
    const council = await prisma.council.findUnique({ where: { id: councilId } });
    if (!council) {
      return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Không tìm thấy hội đồng!" };
    }

    const user = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true, email: true } });
    if (!user) {
      return { success: false, status: HTTP_STATUS.NOT_FOUND, message: `Không tìm thấy người dùng với email: ${data.email}` };
    }

    const userRole = await prisma.userRole.findFirst({ where: { userId: user.id }, include: { role: true } });
    if (!userRole) {
      return { success: false, status: HTTP_STATUS.FORBIDDEN, message: "Người này không phải là giảng viên!" };
    }

    const overlappingCouncil = await prisma.council.findFirst({
      where: {
        id: { not: councilId },
        AND: [
          { councilStartDate: { lt: council.councilEndDate! } },
          { councilEndDate: { gt: council.councilStartDate! } },
        ],
        members: { some: { userId: user.id } },
      },
    });

    if (overlappingCouncil) {
      return {
        success: false,
        status: HTTP_STATUS.BAD_REQUEST,
        message: `Giảng viên đã tham gia hội đồng "${overlappingCouncil.name}" (code: ${overlappingCouncil.code}) có lịch họp từ ${overlappingCouncil.councilStartDate!.toISOString()} đến ${overlappingCouncil.councilEndDate!.toISOString()}, không thể tham gia hội đồng mới có thời gian giao nhau.`,
      };
    }

    const maxCouncilMembers = await systemConfigService.getMaxCouncilMembers();
    const currentMemberCount = await prisma.councilMember.count({ where: { councilId } });
    if (currentMemberCount >= maxCouncilMembers) {
      return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: `Số lượng thành viên hội đồng đã đạt tối đa (${maxCouncilMembers})!` };
    }

    const existingMember = await prisma.councilMember.findFirst({ where: { councilId, userId: user.id } });
    if (existingMember) {
      return { success: false, status: HTTP_STATUS.CONFLICT, message: "Người dùng đã là thành viên của hội đồng này!" };
    }

    const role = await prisma.role.findUnique({ where: { name: data.role } });
    if (!role) {
      return { success: false, status: HTTP_STATUS.NOT_FOUND, message: `Vai trò ${data.role} không tồn tại!` };
    }

    const newMember = await prisma.councilMember.create({
      data: {
        councilId,
        userId: user.id,
        roleId: role.id,
        assignedAt: nowVN(), // Sửa: Dùng nowVN()
        status: "ACTIVE",
        semesterId: council.semesterId || '',
      },
    });

    return { success: true, status: HTTP_STATUS.CREATED, message: "Thêm thành viên vào hội đồng thành công!", data: newMember };
  } catch (error) {
    console.error("Lỗi khi thêm thành viên vào hội đồng:", error);
    return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
  }
}

  async deleteTopicCouncil(councilId: string, userId: string, ipAddress?: string): Promise<{ success: boolean; status: number; message: string; data?: any }> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { roles: { include: { role: true } } } });
    if (!user) throw new Error('Người dùng không tồn tại');
    const userRoles = user.roles.map(r => r.role.name.toLowerCase());
   

    const council = await prisma.council.findUnique({ where: { id: councilId, isDeleted: false } });
    if (!council) {
      await prisma.systemLog.create({
        data: {
          userId,
          action: 'DELETE_TOPIC_COUNCIL_ATTEMPT',
          entityType: 'Council',
          entityId: councilId,
          description: 'Thử xóa hội đồng topic nhưng không tìm thấy hoặc đã bị đánh dấu xóa',
          severity: 'WARNING',
          ipAddress: ipAddress || 'unknown',
          createdAt: nowVN(), // Thêm: Rõ ràng gán createdAt bằng nowVN()
        },
      });
      return { success: false, status: HTTP_STATUS.NOT_FOUND, message: COUNCIL_MESSAGE.COUNCIL_NOT_FOUND };
    }

    const updatedCouncil = await prisma.$transaction(async (tx) => {
      const updatedCounts = { reviewSchedules: 0, defenseSchedules: 0, reviewAssignments: 0, reviewDefenseCouncils: 0, councilMembers: 0, documents: 0 };
      updatedCounts.reviewSchedules = await tx.reviewSchedule.updateMany({ where: { councilId, isDeleted: false }, data: { isDeleted: true } }).then(res => res.count);
      updatedCounts.defenseSchedules = await tx.defenseSchedule.updateMany({ where: { councilId, isDeleted: false }, data: { isDeleted: true } }).then(res => res.count);
      updatedCounts.reviewAssignments = await tx.reviewAssignment.updateMany({ where: { councilId, isDeleted: false }, data: { isDeleted: true } }).then(res => res.count);
      updatedCounts.councilMembers = await tx.councilMember.updateMany({ where: { councilId, isDeleted: false }, data: { isDeleted: true } }).then(res => res.count);
      updatedCounts.documents = await tx.document.updateMany({ where: { councilId, isDeleted: false }, data: { isDeleted: true } }).then(res => res.count);

      await tx.council.update({ where: { id: councilId }, data: { isDeleted: true } });
      await tx.systemLog.create({
        data: {
          userId,
          action: 'DELETE_TOPIC_COUNCIL',
          entityType: 'Council',
          entityId: councilId,
          description: `Hội đồng topic "${council.name}" đã được đánh dấu xóa`,
          severity: 'INFO',
          ipAddress: ipAddress || 'unknown',
          metadata: { councilCode: council.code, councilName: council.name, updatedCounts, deletedBy: userRoles.join(', ') },
          oldValues: JSON.stringify(council),
          createdAt: nowVN(), // Thêm: Rõ ràng gán createdAt bằng nowVN()
        },
      });

      return await tx.council.findUnique({ where: { id: councilId } });
    });

    return { success: true, status: HTTP_STATUS.OK, message: COUNCIL_MESSAGE.COUNCIL_DELETED, data: updatedCouncil };
  } catch (error) {
    await prisma.systemLog.create({
      data: {
        userId,
        action: 'DELETE_TOPIC_COUNCIL_ERROR',
        entityType: 'Council',
        entityId: councilId,
        description: 'Lỗi hệ thống khi đánh dấu xóa hội đồng topic',
        severity: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
        stackTrace: (error as Error).stack || 'No stack trace',
        ipAddress: ipAddress || 'unknown',
        createdAt: nowVN(), // Thêm: Rõ ràng gán createdAt bằng nowVN()
      },
    });
    console.error('Lỗi khi đánh dấu xóa hội đồng topic:', error);
    return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi hệ thống khi đánh dấu xóa hội đồng.' };
  }
}

  async removeMemberFromCouncil(councilId: string, userId: string) {
    try {
      const council = await prisma.council.findUnique({ where: { id: councilId } });
      if (!council) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Không tìm thấy hội đồng!" };
      }

      const member = await prisma.councilMember.findFirst({ where: { councilId, userId } });
      if (!member) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Thành viên không thuộc hội đồng này!" };
      }

      await prisma.councilMember.delete({ where: { id: member.id } });
      return { success: true, status: HTTP_STATUS.OK, message: "Xóa thành viên khỏi hội đồng thành công!" };
    } catch (error) {
      console.error("Lỗi khi xóa thành viên khỏi hội đồng:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
    }
  }

  async getCouncilDetailsForLecturer(councilId: string, userId: string) {
    try {
      const isMember = await prisma.councilMember.findFirst({ where: { councilId, userId } });
      if (!isMember) {
        return { success: false, status: HTTP_STATUS.FORBIDDEN, message: "Bạn không phải thành viên của hội đồng này." };
      }

      const council = await prisma.council.findUnique({
        where: { id: councilId },
        include: {
          members: { include: { user: { select: { id: true, fullName: true, email: true , username: true } }, role: { select: { id: true, name: true } } } },
          semester: { select: { id: true, code: true, startDate: true, endDate: true } },
          submissionPeriod: { select: { id: true, roundNumber: true, startDate: true, endDate: true } },
        },
      });

      if (!council) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: COUNCIL_MESSAGE.COUNCIL_NOT_FOUND };
      }

      const councilWithRoleNames = {
        ...council,
        members: council.members.map(member => ({ ...member, roleName: member.role.name || "Không xác định" })),
      };

      return { success: true, status: HTTP_STATUS.OK, message: COUNCIL_MESSAGE.COUNCIL_FETCHED, data: councilWithRoleNames };
    } catch (error) {
      console.error("Lỗi khi lấy chi tiết hội đồng cho giảng viên:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: COUNCIL_MESSAGE.COUNCIL_LIST_FAILED };
    }
  }

  async reviewTopicByCouncilMember(topicId: string, status: 'APPROVED' | 'REJECTED' | 'IMPROVED', userId: string, reviewReason?: string) {
  try {
    if (!['APPROVED', 'REJECTED', 'IMPROVED'].includes(status)) {
      return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: 'Trạng thái không hợp lệ! Chỉ chấp nhận APPROVED, REJECTED hoặc IMPROVED.' };
    }

    const councilMember = await prisma.councilMember.findFirst({
      where: {
        userId,
        council: { type: 'CHECK-TOPIC', isDeleted: false },
        isDeleted: false,
      },
    });

    if (!councilMember) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } },
      });

      const userRoles = user?.roles.map(r => r.role.name.toLowerCase()) || [];
      const isAuthorizedManager = userRoles.includes("examination_officer") || userRoles.includes("graduation_thesis_manager");

      if (!isAuthorizedManager) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: 'Bạn không phải là thành viên của bất kỳ hội đồng CHECK-TOPIC nào đang hoạt động!',
        };
      }
    }

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { group: { select: { id: true, groupCode: true, semesterId: true, mentors: { select: { mentorId: true, roleId: true } } } } },
    });

    if (!topic) {
      return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Đề tài không tồn tại!' };
    }

    if (topic.status !== 'PENDING') {
      return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: 'Đề tài không ở trạng thái PENDING nên không thể duyệt!' };
    }

    const updatedTopic = await prisma.topic.update({
      where: { id: topicId },
      data: { status, reviewReason: reviewReason || null, updatedAt: nowVN() }, // Sửa: Dùng nowVN()
      include: { group: true },
    });

    if (status === 'APPROVED' && topic.proposedGroupId) {
      const existingAssignment = await prisma.topicAssignment.findFirst({ where: { topicId, groupId: topic.proposedGroupId } });
      if (!existingAssignment) {
        await prisma.topicAssignment.create({
          data: { topicId, groupId: topic.proposedGroupId, assignedBy: userId, approvalStatus: 'APPROVED', defendStatus: 'NOT_SCHEDULED', status: 'ASSIGNED' },
        });
      }

      const mentorMainRole = await prisma.role.findUnique({ where: { name: "mentor_main" } });
      if (!mentorMainRole) throw new Error("Vai trò mentor_main không tồn tại.");

      const creator = await prisma.user.findUnique({ where: { id: topic.createdBy }, select: { roles: { select: { role: true } } } });
      const isLecturer = creator?.roles.some(r => r.role.name.toLowerCase() === 'lecturer');

      const hasMentorMain = topic.group?.mentors.some(gm => gm.roleId === mentorMainRole.id) || false;
      if (isLecturer && !hasMentorMain) {
        await prisma.groupMentor.upsert({
          where: { groupId_mentorId: { groupId: topic.proposedGroupId, mentorId: topic.createdBy } },
          update: {},
          create: { groupId: topic.proposedGroupId, mentorId: topic.createdBy, roleId: mentorMainRole.id, addedBy: userId },
        });
      }

      if (topic.subSupervisor) {
        const mentorSubRole = await prisma.role.findUnique({ where: { name: "mentor_sub" } });
        if (!mentorSubRole) throw new Error("Vai trò mentor_sub không tồn tại.");
        const hasMentorSub = topic.group?.mentors.some(gm => gm.mentorId === topic.subSupervisor) || false;
        if (!hasMentorSub) {
          await prisma.groupMentor.create({
            data: { groupId: topic.proposedGroupId, mentorId: topic.subSupervisor, roleId: mentorSubRole.id, addedBy: userId },
          });
        }
      }
    }

    return {
      success: true,
      status: HTTP_STATUS.OK,
      message: status === 'APPROVED' ? 'Đề tài đã được duyệt thành công!' : status === 'REJECTED' ? 'Đề tài đã bị từ chối.' : 'Đề tài cần được cải thiện thêm.',
      data: { topic: updatedTopic, group: updatedTopic.group },
    };
  } catch (error) {
    console.error('Lỗi khi thành viên hội đồng duyệt đề tài:', error);
    return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi hệ thống khi duyệt đề tài!' };
  }
}

  async getTopicsForApprovalBySubmission(query: { submissionPeriodId?: string; round?: number; semesterId?: string }, userId: string) {
    try {
      const userRoles = await prisma.userRole.findMany({ where: { userId: userId, isActive: true }, include: { role: true } });
      const roleNames = userRoles.map(userRole => userRole.role.name.toUpperCase());
      const privilegedRoles = ['ACADEMIC_OFFICER', 'GRADUATION_THESIS_MANAGER', 'EXAMINATION_OFFICER'];
      const hasPrivilegedRole = roleNames.some(role => privilegedRoles.includes(role));

      let submissionPeriodId: string;
      let roundNumber: number;

      if (query.submissionPeriodId) {
        submissionPeriodId = query.submissionPeriodId;
        const submissionPeriod = await prisma.submissionPeriod.findUnique({
          where: { id: submissionPeriodId, isDeleted: false },
          select: { id: true, roundNumber: true, semesterId: true, type: true },
        });
        if (!submissionPeriod) {
          return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy đợt xét duyệt!' };
        }
        if (submissionPeriod.type !== 'TOPIC') {
          return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: 'Đợt xét duyệt phải thuộc loại TOPIC!' };
        }
        roundNumber = submissionPeriod.roundNumber;

        if (query.round !== undefined && query.round !== roundNumber) {
          return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: `Đợt xét duyệt bạn chọn thuộc vòng ${roundNumber}, không phải vòng ${query.round} mà bạn yêu cầu!` };
        }
      } else if (query.round !== undefined && query.semesterId) {
        const semester = await prisma.semester.findUnique({ where: { id: query.semesterId, isDeleted: false } });
        if (!semester) {
          return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy học kỳ!' };
        }
        const submissionPeriod = await prisma.submissionPeriod.findFirst({
          where: { semesterId: query.semesterId, roundNumber: query.round, type: 'TOPIC', isDeleted: false },
          select: { id: true, roundNumber: true },
        });
        if (!submissionPeriod) {
          return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy đợt xét duyệt TOPIC!' };
        }
        submissionPeriodId = submissionPeriod.id;
        roundNumber = submissionPeriod.roundNumber;
      } else {
        return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: 'Vui lòng cung cấp đủ thông tin (submissionPeriodId hoặc round và semesterId)!' };
      }

      const isLecturer = roleNames.includes('LECTURER');
      let hasAccess = hasPrivilegedRole;

      if (!hasAccess && isLecturer) {
        const councilMember = await prisma.councilMember.findFirst({
          where: {
            userId: userId,
            council: { relatedSubmissionPeriodId: submissionPeriodId, type: 'CHECK-TOPIC', isDeleted: false },
            isDeleted: false,
          },
          include: { role: true, council: true },
        });

        if (councilMember && councilMember.role.name.toUpperCase() === 'COUNCIL_MEMBER') {
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        return { success: false, status: HTTP_STATUS.FORBIDDEN, message: 'Rất tiếc, bạn không có quyền xem danh sách đề tài cần duyệt của đợt này.' };
      }

      const topics = await prisma.topic.findMany({
        where: { submissionPeriodId, status: 'PENDING', isDeleted: false },
        include: { group: { select: { groupCode: true, id: true } } },
      });

      if (topics.length === 0) {
        return { success: true, status: HTTP_STATUS.OK, data: [], message: 'Không có đề tài nào cần duyệt trong đợt này.' };
      }

      return { success: true, status: HTTP_STATUS.OK, data: topics };
    } catch (error) {
      console.error('Lỗi khi lấy danh sách đề tài:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Đã xảy ra lỗi hệ thống, vui lòng thử lại sau!' };
    }
  }
}