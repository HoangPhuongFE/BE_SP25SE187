import { PrismaClient } from '@prisma/client';
import HTTP_STATUS from '../constants/httpStatus';
import COUNCIL_MESSAGE from '../constants/message';
import { SystemConfigService } from './system.config.service';
import { Realtime } from 'openai/resources/beta/realtime/realtime';

const prisma = new PrismaClient();
const systemConfigService = new SystemConfigService();

export class CouncilReviewService {
  static updateReviewSchedule(scheduleId: string, arg1: { status: any; room: any; reviewTime: Date | undefined; notes: any; groupId: any; groupCode: any; }, userId: any) {
    throw new Error('Method not implemented.');
  }
  // API 1: Tạo hội đồng xét duyệt 
  async createCouncil(data: {
    name: string;
    semesterId: string;
    submissionPeriodId?: string;
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
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Người tạo không tồn tại!",
        };
      }
      const creatorRoles = creator.roles.map(r => r.role.name.toLowerCase());
      if (creatorRoles.includes("academic_officer") || creatorRoles.includes("admin")) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Academic officer và admin không được phép tạo hội đồng.",
        };
      }

      const semester = await prisma.semester.findUnique({
        where: { id: data.semesterId },
      });
      if (!semester) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Học kỳ không tồn tại!",
        };
      }

      if (data.submissionPeriodId) {
        const submissionPeriod = await prisma.submissionPeriod.findUnique({
          where: { id: data.submissionPeriodId },
        });
        if (!submissionPeriod) {
          return {
            success: false,
            status: HTTP_STATUS.NOT_FOUND,
            message: "Đợt xét duyệt không tồn tại!",
          };
        }
      }

      if (data.startDate >= data.endDate) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: "Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc.",
        };
      }

      const now = new Date();
      let computedStatus = data.status || "ACTIVE";
      if (now < data.startDate) {
        computedStatus = "UPCOMING";
      } else if (now >= data.startDate && now <= data.endDate) {
        computedStatus = "ACTIVE";
      } else {
        computedStatus = "COMPLETE";
      }

      const prefix = `${(data.type || "review").toUpperCase()}-${data.round || 1}-${semester.code}`;
      const count = await prisma.council.count({
        where: { code: { startsWith: prefix } },
      });
      const sequenceNumber = (count + 1).toString().padStart(3, "0");
      const councilCode = `${prefix}-${sequenceNumber}`;

      const existingCouncil = await prisma.council.findUnique({
        where: { code: councilCode },
      });
      if (existingCouncil) {
        return {
          success: false,
          status: HTTP_STATUS.CONFLICT,
          message: "Mã hội đồng đã tồn tại.",
        };
      }

      const newCouncil = await prisma.council.create({
        data: {
          name: data.name,
          semesterId: data.semesterId,
          submissionPeriodId: data.submissionPeriodId || null,
          councilStartDate: data.startDate,
          councilEndDate: data.endDate,
          status: computedStatus,
          type: data.type || "review",
          round: data.round || 1,
          createdDate: new Date(),
          code: councilCode,
        },
      });

      return {
        success: true,
        status: HTTP_STATUS.CREATED,
        message: "Tạo hội đồng xét duyệt thành công!",
        data: newCouncil,
      };
    } catch (error: any) {
      console.error("Lỗi khi tạo hội đồng xét duyệt:", error);
      if (error.code === "P2002" && error.meta?.target.includes("councils_council_code_key")) {
        return {
          success: false,
          status: HTTP_STATUS.CONFLICT,
          message: "Mã hội đồng trùng lặp.",
        };
      }
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống khi tạo hội đồng xét duyệt.",
      };
    }
  }

  // API: Cập nhật hội đồng xét duyệt 
  async updateReviewCouncil(councilId: string, data: {
    name?: string;
    code?: string;
    round?: number;
    status?: string;
    councilStartDate?: Date;
    councilEndDate?: Date;
  }) {
    try {
      let updateData: any = { ...data };
      if (data.councilStartDate && data.councilEndDate) {
        const now = new Date();
        let computedStatus = data.status || "ACTIVE";
        if (now < data.councilStartDate) {
          computedStatus = "UPCOMING";
        } else if (now >= data.councilStartDate && now <= data.councilEndDate) {
          computedStatus = "ACTIVE";
        } else {
          computedStatus = "COMPLETE";
        }
        updateData.status = computedStatus;
      }

      const updatedCouncil = await prisma.council.update({
        where: { id: councilId },
        data: updateData,
      });

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: COUNCIL_MESSAGE.COUNCIL_UPDATED,
        data: updatedCouncil,
      };
    } catch (error) {
      console.error("Lỗi khi cập nhật hội đồng xét duyệt:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: COUNCIL_MESSAGE.COUNCIL_UPDATE_FAILED,
      };
    }
  }

  // API: Lấy danh sách hội đồng 
  async getReviewCouncils(filter: {
    semesterId?: string;
    submissionPeriodId?: string;
    round?: number;
    user?: { userId: string; roles: { name: string; semesterId?: string | null }[] };
  }) {
    try {
      const { semesterId, submissionPeriodId, round, user } = filter;
      let whereClause: any = {
        type: "review",
        ...(semesterId && { semesterId }),
        ...(submissionPeriodId && { submissionPeriodId }),
        ...(round !== undefined && { round }),
      };

      if (user && user.roles.some(role => role.name === "lecturer") && !user.roles.some(role => ["examination_officer", "graduation_thesis_manager"].includes(role.name))) {
        whereClause = {
          ...whereClause,
          members: {
            some: {
              userId: user.userId,
            },
          },
        };
        //  console.log(`Filtering councils for lecturer ${user.userId}`);
      }

      const councils = await prisma.council.findMany({
        where: whereClause,
        include: {
          members: {
            include: {
              user: { select: { id: true, fullName: true, email: true } },
            },
          },
        },
      });

      const roleIds = councils.flatMap(c => c.members.map(m => m.roleId)).filter((id, i, self) => self.indexOf(id) === i);
      const roles = await prisma.role.findMany({
        where: { id: { in: roleIds } },
        select: { id: true, name: true },
      });
      const roleMap = new Map(roles.map(r => [r.id, r.name]));

      const councilsWithRoleNames = councils.map(council => ({
        ...council,
        members: council.members.map(member => ({
          ...member,
          roleName: roleMap.get(member.roleId) || "Không xác định",
        })),
      }));

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: COUNCIL_MESSAGE.COUNCIL_LIST_FETCHED,
        data: councilsWithRoleNames,
      };
    } catch (error) {
      console.error("Lỗi khi lấy danh sách hội đồng xét duyệt:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: COUNCIL_MESSAGE.COUNCIL_LIST_FAILED,
      };
    }
  }

  // API: Lấy chi tiết hội đồng theo ID 
  async getReviewCouncilById(councilId: string) {
    try {
      const council = await prisma.council.findUnique({
        where: { id: councilId },
        include: {
          members: {
            include: {
              user: { select: { id: true, fullName: true, email: true } },
            },
          },
        },
      });

      if (!council) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: COUNCIL_MESSAGE.COUNCIL_NOT_FOUND,
        };
      }

      const roleIds = council.members.map(m => m.roleId);
      const roles = await prisma.role.findMany({
        where: { id: { in: roleIds } },
        select: { id: true, name: true },
      });
      const roleMap = new Map(roles.map(r => [r.id, r.name]));

      const councilWithRoleNames = {
        ...council,
        members: council.members.map(member => ({
          ...member,
          roleName: roleMap.get(member.roleId) || "Không xác định",
        })),
      };

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: COUNCIL_MESSAGE.COUNCIL_FETCHED,
        data: councilWithRoleNames,
      };
    } catch (error) {
      console.error("Lỗi khi lấy hội đồng xét duyệt:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: COUNCIL_MESSAGE.COUNCIL_LIST_FAILED,
      };
    }
  }

  // API 2: Thêm thành viên vào hội đồng
  async addMemberToCouncil(councilId: string, data: { email: string; role: string; addedBy: string }) {
    try {
      const council = await prisma.council.findUnique({ where: { id: councilId } });
      if (!council) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Không tìm thấy hội đồng!",
        };
      }

      const user = await prisma.user.findUnique({
        where: { email: data.email },
        select: { id: true, email: true },
      });
      if (!user) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: `Không tìm thấy người dùng với email: ${data.email}`,
        };
      }

      const userRole = await prisma.userRole.findFirst({
        where: { userId: user.id },
        include: { role: true },
      });
      if (!userRole) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Người này không phải là giảng viên!",
        };
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
          message: `Giảng viên đã tham gia hội đồng "${overlappingCouncil.name}" (code: ${overlappingCouncil.code}) có lịch họp giao nhau.`,
        };
      }

      const maxCouncilMembers = await systemConfigService.getMaxCouncilMembers();
      const currentMemberCount = await prisma.councilMember.count({ where: { councilId } });
      if (currentMemberCount >= maxCouncilMembers) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: `Số lượng thành viên hội đồng đã đạt tối đa (${maxCouncilMembers})!`,
        };
      }

      const existingMember = await prisma.councilMember.findFirst({
        where: { councilId, userId: user.id },
      });
      if (existingMember) {
        return {
          success: false,
          status: HTTP_STATUS.CONFLICT,
          message: "Người dùng đã là thành viên của hội đồng này!",
        };
      }

      const role = await prisma.role.findUnique({
        where: { name: data.role },
      });
      if (!role) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: `Vai trò ${data.role} không tồn tại!`,
        };
      }

      const newMember = await prisma.councilMember.create({
        data: {
          councilId,
          userId: user.id,
          roleId: role.id,
          assignedAt: new Date(),
          status: "ACTIVE",
          semesterId: council.semesterId || '',
        },
      });

      return {
        success: true,
        status: HTTP_STATUS.CREATED,
        message: "Thêm thành viên vào hội đồng thành công!",
        data: newMember,
      };
    } catch (error) {
      console.error("Lỗi khi thêm thành viên vào hội đồng:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống!",
      };
    }
  }

  // API: Xóa hội đồng 
  async deleteReviewCouncil(councilId: string, userId: string, ipAddress?: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } },
      });
      if (!user) {
        throw new Error("Người dùng không tồn tại");
      }
      const userRoles = user.roles.map((r) => r.role.name.toLowerCase());
      const isAuthorized = userRoles.includes("graduation_thesis_manager") || userRoles.includes("examination_officer");
      if (!isAuthorized) {
        throw new Error("Chỉ graduation_thesis_manager hoặc examination_officer mới có quyền xóa hội đồng");
      }

      const council = await prisma.council.findUnique({
        where: { id: councilId, isDeleted: false },
      });
      if (!council) {
        await prisma.systemLog.create({
          data: {
            userId,
            action: "DELETE_REVIEW_COUNCIL_ATTEMPT",
            entityType: "Council",
            entityId: councilId,
            description: "Thử xóa hội đồng xét duyệt nhưng không tìm thấy hoặc đã bị đánh dấu xóa",
            severity: "WARNING",
            ipAddress: ipAddress || "unknown",
          },
        });
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: COUNCIL_MESSAGE.COUNCIL_NOT_FOUND };
      }

      const updatedCouncil = await prisma.$transaction(async (tx) => {
        const updatedCounts = {
          reviewSchedules: 0,
          defenseSchedules: 0,
          defenseMemberResults: 0, 
          reviewAssignments: 0,
          councilMembers: 0,
          documents: 0,
        };

        updatedCounts.reviewSchedules = await tx.reviewSchedule
          .updateMany({
            where: { councilId, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);

        const defenseScheduleIds = await tx.defenseSchedule
          .findMany({
            where: { councilId, isDeleted: false },
            select: { id: true },
          })
          .then((schedules) => schedules.map((s) => s.id));

        updatedCounts.defenseSchedules = await tx.defenseSchedule
          .updateMany({
            where: { councilId, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);

        updatedCounts.defenseMemberResults = await tx.defenseMemberResult
          .updateMany({
            where: { defenseScheduleId: { in: defenseScheduleIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);

        updatedCounts.reviewAssignments = await tx.reviewAssignment
          .updateMany({
            where: { councilId, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);

        updatedCounts.councilMembers = await tx.councilMember
          .updateMany({
            where: { councilId, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);

        updatedCounts.documents = await tx.document
          .updateMany({
            where: { councilId, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);

        await tx.council.update({
          where: { id: councilId },
          data: { isDeleted: true },
        });

        await tx.systemLog.create({
          data: {
            userId,
            action: "DELETE_REVIEW_COUNCIL",
            entityType: "Council",
            entityId: councilId,
            description: `Hội đồng xét duyệt "${council.name}" đã được đánh dấu xóa`,
            severity: "INFO",
            ipAddress: ipAddress || "unknown",
            metadata: {
              councilCode: council.code,
              councilName: council.name,
              deletedDefenseMemberResultCount: updatedCounts.defenseMemberResults,
              updatedCounts,
              deletedBy: userRoles.join(", "),
            },
            oldValues: JSON.stringify(council),
          },
        });

        return await tx.council.findUnique({ where: { id: councilId } });
      });

      return { success: true, status: HTTP_STATUS.OK, message: COUNCIL_MESSAGE.COUNCIL_DELETED, data: updatedCouncil };
    } catch (error) {
      await prisma.systemLog.create({
        data: {
          userId,
          action: "DELETE_REVIEW_COUNCIL_ERROR",
          entityType: "Council",
          entityId: councilId,
          description: "Lỗi hệ thống khi đánh dấu xóa hội đồng xét duyệt",
          severity: "ERROR",
          error: error instanceof Error ? error.message : "Unknown error",
          stackTrace: (error as Error).stack || "No stack trace",
          ipAddress: ipAddress || "unknown",
        },
      });
      console.error("Lỗi khi đánh dấu xóa hội đồng xét duyệt:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống khi đánh dấu xóa hội đồng." };
    }
  }

  // API: Xóa thành viên khỏi hội đồng 
  async removeMemberFromCouncil(councilId: string, userId: string) {
    try {
      const council = await prisma.council.findUnique({ where: { id: councilId } });
      if (!council) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Không tìm thấy hội đồng!",
        };
      }

      const member = await prisma.councilMember.findFirst({
        where: { councilId, userId },
      });
      if (!member) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Thành viên không thuộc hội đồng này!",
        };
      }

      await prisma.councilMember.delete({ where: { id: member.id } });

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: "Xóa thành viên khỏi hội đồng thành công!",
      };
    } catch (error) {
      console.error("Lỗi khi xóa thành viên khỏi hội đồng:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống!",
      };
    }
  }

  // API: Lấy chi tiết hội đồng cho giảng viên 
  async getCouncilDetailsForLecturer(councilId: string, userId: string) {
    try {
      // Kiểm tra user là thành viên hội đồng
      const isMember = await prisma.councilMember.findFirst({
        where: { councilId, userId, isDeleted: false },
      });
      if (!isMember) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Bạn không phải thành viên của hội đồng này.",
        };
      }

      // Truy vấn đầy đủ dữ liệu hội đồng
      const council = await prisma.council.findUnique({
        where: { id: councilId, isDeleted: false },
        include: {
          members: {
            include: {
              user: { select: { id: true, fullName: true, email: true } },
              role: { select: { id: true, name: true } },
            },
          },
          semester: { select: { id: true, code: true, startDate: true, endDate: true } },
          submissionPeriod: { select: { id: true, roundNumber: true, startDate: true, endDate: true } },
          reviewAssignments: {
            include: {
              topic: { select: { id: true, topicCode: true, name: true } },
              reviewer: { select: { id: true, fullName: true, email: true } },
              reviewSchedule: true,
            },
          },
          defenseSchedules: {
            include: {
              group: { select: { id: true, groupCode: true } },
            },
          },
          sessions: { // Tức là ReviewSchedule
            include: {
              group: { select: { id: true, groupCode: true } },
              topic: { select: { id: true, topicCode: true, name: true } },
              assignments: {
                include: {
                  reviewer: { select: { id: true, fullName: true } },
                },
              },
              documents: {
                where: { isDeleted: false },
                select: { id: true, fileName: true, fileUrl: true, documentType: true, uploadedAt: true },
              },
            },
          },
          documents: {
            where: { isDeleted: false },
            select: { id: true, fileName: true, fileUrl: true, documentType: true, uploadedAt: true },
          },
        },
      });

      if (!council) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: COUNCIL_MESSAGE.COUNCIL_NOT_FOUND,
        };
      }

      // Thêm roleName vào members
      const councilWithRoleNames = {
        ...council,
        members: council.members.map(member => ({
          ...member,
          roleName: member.role.name || "Không xác định",
        })),
      };

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: COUNCIL_MESSAGE.COUNCIL_FETCHED,
        data: councilWithRoleNames,
      };
    } catch (error) {
      console.error("Lỗi khi lấy chi tiết hội đồng cho giảng viên:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: COUNCIL_MESSAGE.COUNCIL_LIST_FAILED,
      };
    }
  }

  // API 3: Tạo lịch chấm điểm (Thêm nhóm vào hội đồng) 
  async createReviewSchedule(data: {
    councilId: string;
    groups: { groupId: string; reviewTime: Date }[];
    room: string;
    createdBy: string;
  }) {
    try {
      const maxTopicsPerSchedule = await systemConfigService.getMaxTopicsPerCouncilSchedule();

      // Kiểm tra số lượng nhóm
      if (data.groups.length < 1 || data.groups.length > maxTopicsPerSchedule) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: `Số lượng nhóm phải từ 1 đến ${maxTopicsPerSchedule}!`,
        };
      }

      // Kiểm tra hội đồng tồn tại
      const council = await prisma.council.findUnique({
        where: { id: data.councilId, isDeleted: false },
        include: { members: { include: { user: true } } },
      });
      if (!council) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Hội đồng không tồn tại!",
        };
      }

      // Kiểm tra trùng thời gian trong danh sách nhóm
      const reviewTimes = data.groups.map(g => g.reviewTime.getTime());
      const hasDuplicateTime = new Set(reviewTimes).size !== reviewTimes.length;
      if (hasDuplicateTime) {
        return {
          success: false,
          status: HTTP_STATUS.CONFLICT,
          message: "Có các nhóm trong danh sách bị trùng thời gian chấm điểm!",
        };
      }

      // Kiểm tra trùng thời gian với lịch hiện có
      const allSchedules = await prisma.reviewSchedule.findMany({
        where: { councilId: data.councilId, isDeleted: false },
      });
      for (const group of data.groups) {
        const overlappingSchedule = allSchedules.find(
          s => Math.abs(s.reviewTime.getTime() - group.reviewTime.getTime()) < 1000
        );
        if (overlappingSchedule) {
          return {
            success: false,
            status: HTTP_STATUS.CONFLICT,
            message: `Hội đồng đã có lịch chấm tại ${overlappingSchedule.reviewTime.toISOString()} trùng với nhóm ${group.groupId}!`,
          };
        }
      }

      // Kiểm tra phân công đề tài cho nhóm
      const groupIds = data.groups.map(g => g.groupId);
      const topicAssignments = await prisma.topicAssignment.findMany({
        where: { groupId: { in: groupIds }, status: "ASSIGNED", isDeleted: false },
        include: { topic: { select: { id: true, topicCode: true, status: true } } },
      });

      const groupsWithoutAssignment = groupIds.filter(
        groupId => !topicAssignments.some(ta => ta.groupId === groupId)
      );
      if (groupsWithoutAssignment.length > 0) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: `Các nhóm chưa được phân công đề tài: ${groupsWithoutAssignment.join(", ")}!`,
        };
      }

      // Kiểm tra trạng thái đề tài
      const validStatuses = ["APPROVED"];
      const invalidTopics = topicAssignments.filter(ta => !validStatuses.includes(ta.topic.status));
      if (invalidTopics.length > 0) {
        const invalidDetails = invalidTopics.map(ta => `${ta.topic.id} (${ta.topic.status})`);
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: `Các đề tài không ở trạng thái phù hợp để chấm: ${invalidDetails.join(", ")}!`,
        };
      }

      const topicIds = topicAssignments.map(ta => ta.topicId);

      // Kiểm tra xung đột với hội đồng khác
      const scheduledTopics = await prisma.reviewSchedule.findMany({
        where: {
          topicId: { in: topicIds },
          councilId: { not: data.councilId },
          isDeleted: false,
        },
        include: { council: { select: { id: true, name: true } } },
      });
      if (scheduledTopics.length > 0) {
        const scheduledDetails = scheduledTopics.map(
          st => `Đề tài ${st.topicId} đã được hội đồng ${st.council.name} (ID: ${st.council.id}) lên lịch!`
        );
        return {
          success: false,
          status: HTTP_STATUS.CONFLICT,
          message: `Các đề tài đã được lên lịch bởi hội đồng khác: ${scheduledDetails.join(", ")}`,
        };
      }

      // Kiểm tra reviewRound trong cùng hội đồng
      const existingSchedules = await prisma.reviewSchedule.findMany({
        where: {
          topicId: { in: topicIds },
          councilId: data.councilId,
          isDeleted: false,
        },
        select: { topicId: true, reviewRound: true },
      });

      // Kiểm tra xung đột mentor và thành viên hội đồng
      const councilMemberIds = council.members.map(member => member.userId);
      const groupMentors = await prisma.groupMentor.findMany({
        where: { groupId: { in: groupIds }, isDeleted: false },
        include: { mentor: { select: { id: true, fullName: true, email: true } }, group: { select: { groupCode: true } } },
      });

      for (const assignment of topicAssignments) {
        const mentorsForGroup = groupMentors.filter(gm => gm.groupId === assignment.groupId);
        const conflictingMentor = mentorsForGroup.find(gm => councilMemberIds.includes(gm.mentorId));
        if (conflictingMentor) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: `Thành viên hội đồng không được trùng với mentor của nhóm (${conflictingMentor.mentor.fullName}, email: ${conflictingMentor.mentor.email}) trong đề tài ${assignment.topicId}!`,
          };
        }
      }

      // Transaction: Tạo ReviewSchedule và ReviewAssignment
      const newSchedules = await prisma.$transaction(async (tx) => {
        const schedules = [];
        for (const group of data.groups) {
          const assignment = topicAssignments.find(ta => ta.groupId === group.groupId);
          if (!assignment) continue;

          // Tính reviewRound
          const existingRounds = existingSchedules
            .filter(s => s.topicId === assignment.topicId)
            .map(s => s.reviewRound);
          const nextReviewRound = existingRounds.length > 0 ? Math.max(...existingRounds) + 1 : 1;

          // Tạo ReviewSchedule với status PENDING
          const schedule = await tx.reviewSchedule.create({
            data: {
              councilId: data.councilId,
              topicId: assignment.topicId,
              groupId: group.groupId,
              reviewTime: group.reviewTime,
              room: data.room,
              reviewRound: nextReviewRound,
              status: "PENDING", // Rõ ràng thêm status PENDING
            },
            include: {
              topic: { select: { topicCode: true, name: true } },
              group: {
                select: {
                  groupCode: true,
                  members: { where: { isDeleted: false }, include: { user: { select: { fullName: true } }, student: { select: { studentCode: true } } } },
                },
              },
              council: { select: { name: true } },
            },
          });

          // Tạo ReviewAssignment với status PENDING
          const reviewAssignment = await tx.reviewAssignment.create({
            data: {
              councilId: data.councilId,
              topicId: assignment.topicId,
              reviewerId: null,
              reviewRound: nextReviewRound,
              status: "PENDING", // Rõ ràng thêm status PENDING
              reviewScheduleId: schedule.id,
            },
          });

          // Lưu cả schedule và ReviewAssignment
          schedules.push({
            schedule,
            assignment: reviewAssignment,
          });
        }
        return schedules;
      });

      // Chuẩn bị response với đầy đủ dữ liệu
      const responseData = newSchedules.map(item => ({
        schedule: item.schedule,
        assignment: item.assignment,
      }));

      return {
        success: true,
        status: HTTP_STATUS.CREATED,
        message: "Tạo lịch chấm điểm cho các nhóm thành công!",
        data: responseData,
      };
    } catch (error) {
      console.error("Lỗi khi tạo lịch chấm điểm:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống khi tạo lịch chấm điểm!",
      };
    }
  }

  // API 4: Student xem lịch nhóm 
  async getReviewScheduleForStudent(userId: string) {
    try {
      const activeSemester = await prisma.semester.findFirst({
        where: { status: "active", isDeleted: false },
        orderBy: { startDate: "desc" },
      });

      if (!activeSemester) {
        return {
          success: false,
          status: HTTP_STATUS.OK,
          message: "Hiện tại không có học kỳ nào đang hoạt động!",
        };
      }

      const student = await prisma.student.findFirst({
        where: { userId, isDeleted: false },
        select: { id: true },
      });

      if (!student) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Không tìm thấy thông tin sinh viên!",
        };
      }

      const groupMember = await prisma.groupMember.findFirst({
        where: {
          studentId: student.id,
          isDeleted: false,
          group: { semesterId: activeSemester.id, isDeleted: false },
        },
        include: { group: true },
      });

      if (!groupMember) {
        return {
          success: false,
          status: HTTP_STATUS.OK,
          message: "Bạn hiện không thuộc nhóm nào trong kỳ hiện tại!",
        };
      }

      if (!groupMember.isActive) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Tài khoản của bạn hiện không hoạt động, vui lòng liên hệ quản lý để được hỗ trợ!",
        };
      }

      const schedules = await prisma.reviewSchedule.findMany({
        where: { groupId: groupMember.groupId, isDeleted: false },
        include: {
          topic: { select: { topicCode: true, name: true } },
          group: { select: { groupCode: true } },
          council: { select: { name: true } },
          assignments: {
            select: { id: true, score: true, status: true, feedback: true, reviewerId: true, assignedAt: true, reviewedAt: true },
          },
          documents: {
            where: { documentType: "REVIEW_REPORT", isDeleted: false },
            select: { fileUrl: true },
          },
        },
      });

      if (schedules.length === 0) {
        return {
          success: false,
          status: HTTP_STATUS.OK,
          message: "Nhóm của bạn hiện chưa có lịch chấm điểm nào!",
        };
      }

      const result = schedules.map(schedule => ({
        schedule: {
          id: schedule.id,
          councilId: schedule.councilId,
          groupId: schedule.groupId,
          topicId: schedule.topicId,
          reviewTime: schedule.reviewTime,
          room: schedule.room,
          reviewRound: schedule.reviewRound,
          status: schedule.status,
          council: schedule.council.name,
          group: schedule.group.groupCode,
          topic: schedule.topic.name,
        },
        assignment: schedule.assignments[0] || null,
        url: schedule.documents[0]?.fileUrl || null,
      }));

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: "Lấy lịch chấm điểm thành công!",
        data: result,
      };
    } catch (error) {
      console.error("Lỗi khi lấy lịch chấm điểm cho sinh viên:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống khi lấy lịch chấm điểm!",
      };
    }
  }

  // API 5: Mentor xem lịch nhóm
  async getReviewScheduleForMentor(userId: string) {
    try {
      // 1. Lấy danh sách nhóm mà user là mentor
      const mentorGroups = await prisma.groupMentor.findMany({
        where: { mentorId: userId, isDeleted: false },
        select: { groupId: true },
      });

      const groupIds = mentorGroups.map(gm => gm.groupId);
      if (groupIds.length === 0) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Bạn hiện không phụ trách nhóm nào!",
        };
      }

      // 2. Truy vấn đầy đủ dữ liệu ReviewSchedule và ReviewAssignment
      const schedules = await prisma.reviewSchedule.findMany({
        where: { groupId: { in: groupIds }, isDeleted: false },
        include: {
          council: { select: { id: true, code: true, name: true, status: true, type: true, round: true } },
          group: { select: { id: true, groupCode: true, semesterId: true, status: true } },
          topic: { select: { id: true, topicCode: true, name: true, status: true } },
          assignments: {
            include: {
              council: { select: { id: true, name: true } },
              topic: { select: { id: true, topicCode: true, name: true } },
              reviewer: { select: { id: true, fullName: true, email: true } },
              reviewSchedule: {
                select: { id: true, reviewTime: true, room: true, reviewRound: true, status: true, note: true },
              },
            },
          },
          documents: {
            where: { documentType: "REVIEW_REPORT", isDeleted: false },
            select: { id: true, fileName: true, fileUrl: true, documentType: true, uploadedAt: true, uploadedBy: true },
          },
        },
      });

      if (schedules.length === 0) {
        return {
          success: false,
          status: HTTP_STATUS.OK,
          message: "Hiện tại chưa có lịch chấm điểm nào cho các nhóm bạn phụ trách!",
        };
      }

      // 3. Chuẩn bị dữ liệu trả về
      const result = schedules.map(schedule => ({
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
          council: schedule.council,
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

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: "Lấy lịch chấm điểm thành công!",
        data: result,
      };
    } catch (error) {
      console.error("Lỗi khi lấy lịch chấm điểm cho mentor:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống khi lấy lịch chấm điểm!",
      };
    }
  }

  // API 6: Leader thêm URL
  async addUrlToReviewSchedule(scheduleId: string, url: string, userId: string) {
    try {
      // Tìm vai trò "leader"
      const leaderRole = await prisma.role.findUnique({
        where: { name: "leader" },
        select: { id: true },
      });

      if (!leaderRole) {
        return {
          success: false,
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          message: "Vai trò 'leader' không tồn tại trong hệ thống!",
        };
      }

      // Tìm Student dựa trên userId từ token
      const student = await prisma.student.findFirst({
        where: {
          userId,
          isDeleted: false,
        },
      });

      if (!student) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Không tìm thấy thông tin sinh viên liên kết với tài khoản này!",
        };
      }

      // Kiểm tra xem user có phải leader của nhóm liên quan đến scheduleId không
      const groupMember = await prisma.groupMember.findFirst({
        where: {
          studentId: student.id, // Dùng studentId thay vì userId
          roleId: leaderRole.id,
          group: {
            reviewSchedules: {
              some: { id: scheduleId },
            },
          },
          isDeleted: false,
        },
        include: {
          group: true,
          student: { include: { user: true } },
        },
      });

      if (!groupMember) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Bạn không phải Leader của nhóm hoặc lịch không tồn tại!",
        };
      }

      // Tạo bản ghi Document
      const newDocument = await prisma.document.create({
        data: {
          fileName: "Report URL",
          fileUrl: url,
          fileType: "URL",
          uploadedBy: userId,
          reviewScheduleId: scheduleId,
          documentType: "REVIEW_REPORT",
        },
      });

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: "Thêm URL thành công!",
        data: newDocument,
      };
    } catch (error) {
      console.error("Lỗi khi thêm URL:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống!",
      };
    }
  }

  // API 7: Hội đồng cập nhật trạng thái, note, điểm số
  async updateReviewAssignment(assignmentId: string, data: { score?: number; feedback?: string; status?: string }, userId: string) {
    try {
      // Kiểm tra vai trò từ UserRole
      const userRoles = await prisma.userRole.findMany({
        where: {
          userId,
          isActive: true,
          isDeleted: false,
        },
        include: { role: true },
      });

      const roleNames = userRoles.map((ur) => ur.role.name);
      //console.log("User roles:", roleNames);

      // Các vai trò được phép
      const allowedRoles = ["lecturer", "council_member"];
      const hasPermission = roleNames.some((role) => allowedRoles.includes(role));

      if (!hasPermission) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Bạn không có quyền cập nhật assignment (yêu cầu lecturer hoặc vai trò hội đồng)!",
        };
      }

      // Tìm assignment mà không yêu cầu userId trong CouncilMember
      const assignment = await prisma.reviewAssignment.findFirst({
        where: {
          id: assignmentId,
          isDeleted: false,
        },
      });

      if (!assignment) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Assignment không tồn tại!",
        };
      }

      // Kiểm tra nếu user là thành viên hội đồng (tùy chọn)
      const isCouncilMember = await prisma.councilMember.findFirst({
        where: {
          councilId: assignment.councilId,
          userId,
          isDeleted: false,
        },
      });

      console.log("Is Council Member:", !!isCouncilMember);

      // Cập nhật assignment
      const updatedAssignment = await prisma.reviewAssignment.update({
        where: { id: assignmentId },
        data: {
          score: data.score,
          feedback: data.feedback,
          status: data.status || "COMPLETED",
          reviewerId: userId,
          reviewedAt: new Date(),
        },
      });

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: "Cập nhật thành công!",
        data: updatedAssignment,
      };
    } catch (error) {
      console.error("Lỗi khi cập nhật assignment:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống!",
      };
    }
  }

  // API 8: Hội đồng cập nhật lịch ch 

  async updateReviewSchedule(
    scheduleId: string,
    data: { status?: string; room?: string; reviewTime?: Date; note?: string; groupId?: string; groupCode?: string },
    userId: string
  ) {
    try {
      // 1. Tìm ReviewSchedule
      const schedule = await prisma.reviewSchedule.findFirst({
        where: { id: scheduleId, isDeleted: false },
        include: {
          council: { include: { members: true } },
          group: true,
          topic: true,
          assignments: true,
        },
      });

      if (!schedule) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Lịch chấm điểm không tồn tại!",
        };
      }

      // 2. Kiểm tra user là thành viên hội đồng
      const isCouncilMember = schedule.council.members.some(member => member.userId === userId && !member.isDeleted);
      console.log(`User ${userId} - isCouncilMember: ${isCouncilMember}, Council Members:`, schedule.council.members);
      if (!isCouncilMember) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Bạn không phải thành viên hội đồng của lịch chấm điểm này!",
        };
      }

      // 3. Xử lý linh hoạt groupId hoặc groupCode
      let newGroupId = schedule.groupId;
      if (data.groupId || data.groupCode) {
        let targetGroupId: string | undefined;

        if (data.groupId) {
          targetGroupId = data.groupId;
        } else if (data.groupCode) {
          const groupByCode = await prisma.group.findFirst({
            where: { groupCode: data.groupCode, isDeleted: false },
          });
          if (!groupByCode) {
            return {
              success: false,
              status: HTTP_STATUS.NOT_FOUND,
              message: `Nhóm với mã ${data.groupCode} không tồn tại!`,
            };
          }
          targetGroupId = groupByCode.id;
        }

        if (targetGroupId && targetGroupId !== schedule.groupId) {
          const newGroup = await prisma.group.findUnique({
            where: { id: targetGroupId, isDeleted: false },
          });
          if (!newGroup) {
            return {
              success: false,
              status: HTTP_STATUS.NOT_FOUND,
              message: `Nhóm ${targetGroupId} không tồn tại!`,
            };
          }

          const topicAssignment = await prisma.topicAssignment.findFirst({
            where: { groupId: targetGroupId, status: "ASSIGNED", isDeleted: false },
          });
          if (!topicAssignment) {
            return {
              success: false,
              status: HTTP_STATUS.BAD_REQUEST,
              message: `Nhóm ${targetGroupId} chưa được phân công đề tài!`,
            };
          }

          const overlappingSchedule = await prisma.reviewSchedule.findFirst({
            where: {
              groupId: targetGroupId,
              reviewTime: data.reviewTime || schedule.reviewTime,
              id: { not: scheduleId },
              isDeleted: false,
            },
          });
          if (overlappingSchedule) {
            return {
              success: false,
              status: HTTP_STATUS.CONFLICT,
              message: `Nhóm ${targetGroupId} đã có lịch chấm khác tại ${overlappingSchedule.reviewTime.toISOString()}!`,
            };
          }

          newGroupId = targetGroupId;
        }
      }
    
      // 4. Cập nhật ReviewSchedule
      const updatedSchedule = await prisma.reviewSchedule.update({
        where: { id: scheduleId },
        data: {
          status: data.status || schedule.status,
          room: data.room || schedule.room,
          reviewTime: data.reviewTime || schedule.reviewTime,
          note: data.note !== undefined ? data.note : schedule.note,
          groupId: newGroupId,
          topicId: newGroupId === schedule.groupId
            ? schedule.topicId
            : (await prisma.topicAssignment.findFirst({ where: { groupId: newGroupId, isDeleted: false } }))?.topicId,
        },
        include: {
          topic: { select: { topicCode: true, name: true } },
          group: { select: { groupCode: true } },
          council: { select: { name: true } },
          assignments: true,
        },
      });

      // 5. Nếu thay đổi nhóm, cập nhật ReviewAssignment
      if (newGroupId !== schedule.groupId && schedule.assignments.length > 0) {
        await prisma.reviewAssignment.updateMany({
          where: { reviewScheduleId: scheduleId },
          data: { topicId: updatedSchedule.topicId },
        });
      }

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: "Cập nhật lịch chấm điểm thành công!",
        data: updatedSchedule,
      };
    } catch (error) {
      console.error("Lỗi khi cập nhật lịch chấm điểm:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống khi cập nhật lịch chấm điểm!",
      };
    }
  }

  async confirmDefenseRound(groupCode: string, defenseRound: number, userId: string) {
      try {
        // Kiểm tra defenseRound hợp lệ (1 hoặc 2)
        if (defenseRound !== 1 && defenseRound !== 2) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: "Vòng bảo vệ chỉ có thể là 1 hoặc 2!",
          };
        }

        // Tìm nhóm bằng groupCode
        const group = await prisma.group.findFirst({
          where: { groupCode, isDeleted: false },
        });
        if (!group) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: "Không tìm thấy nhóm với mã groupCode này!",
          };
        }

        // Kiểm tra quyền mentor
        const mentorGroup = await prisma.groupMentor.findFirst({
          where: { mentorId: userId, groupId: group.id, isDeleted: false },
        });
        if (!mentorGroup) {
          return {
            success: false,
            status: HTTP_STATUS.FORBIDDEN,
            message: "Bạn không phải mentor của nhóm này!",
          };
        }

        // Tìm phân công đề tài
        const topicAssignment = await prisma.topicAssignment.findFirst({
          where: { groupId: group.id, isDeleted: false },
        });
        if (!topicAssignment) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: "Nhóm chưa được phân công đề tài!",
          };
        }

        // Cập nhật vòng bảo vệ (không kiểm tra vòng trước)
        const updatedAssignment = await prisma.topicAssignment.update({
          where: { id: topicAssignment.id },
          data: {
            defenseRound: defenseRound.toString(),
            defendStatus: "CONFIRMED",
          },
        });

        return {
          success: true,
          status: HTTP_STATUS.OK,
          message: `Xác nhận nhóm đi bảo vệ vòng ${defenseRound} thành công!`,
          data: updatedAssignment,
        };
      } catch (error) {
        console.error("Lỗi khi xác nhận vòng bảo vệ:", error);
        return {
          success: false,
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          message: "Lỗi hệ thống khi xác nhận vòng bảo vệ!",
        };
      }
    }
  }





