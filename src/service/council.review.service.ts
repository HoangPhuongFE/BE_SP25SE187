import { PrismaClient } from '@prisma/client';
import HTTP_STATUS from '../constants/httpStatus';
import COUNCIL_MESSAGE from '../constants/message';
import { SystemConfigService } from './system.config.service';

const prisma = new PrismaClient();
const systemConfigService = new SystemConfigService();

export class CouncilReviewService {
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
      // 1. Kiểm tra quyền của người tạo
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

      // 2. Kiểm tra học kỳ
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

      // 3. Kiểm tra đợt xét duyệt (nếu có)
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

      // 4. Kiểm tra thời gian
      if (data.startDate >= data.endDate) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: "Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc.",
        };
      }

      // 5. Tính trạng thái
      const now = new Date();
      let computedStatus = data.status || "ACTIVE";
      if (now < data.startDate) {
        computedStatus = "UPCOMING";
      } else if (now >= data.startDate && now <= data.endDate) {
        computedStatus = "ACTIVE";
      } else {
        computedStatus = "COMPLETE";
      }

      // 6. Tạo mã hội đồng
      const prefix = `${(data.type || "review").toUpperCase()}-${data.round || 1}-${semester.code}`;
      const count = await prisma.council.count({
        where: { code: { startsWith: prefix } },
      });
      const sequenceNumber = (count + 1).toString().padStart(3, "0");
      const councilCode = `${prefix}-${sequenceNumber}`;

      // 7. Kiểm tra mã trùng
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

      // 8. Tạo hội đồng
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

  async getReviewCouncils(filter: { semesterId?: string; submissionPeriodId?: string; round?: number }) {
    try {
      const councils = await prisma.council.findMany({
        where: {
          type: "review",
          ...(filter.semesterId && { semesterId: filter.semesterId }),
          ...(filter.submissionPeriodId && { submissionPeriodId: filter.submissionPeriodId }),
          ...(filter.round !== undefined && { round: filter.round }),
        },
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

  async deleteReviewCouncil(councilId: string, userId: string, ipAddress?: string) {
    try {
      const council = await prisma.council.findUnique({
        where: { id: councilId, isDeleted: false },
      });
      if (!council) {
        await prisma.systemLog.create({
          data: {
            userId,
            action: 'DELETE_REVIEW_COUNCIL_ATTEMPT',
            entityType: 'Council',
            entityId: councilId,
            description: 'Thử xóa hội đồng xét duyệt nhưng không tìm thấy hoặc đã bị đánh dấu xóa',
            severity: 'WARNING',
            ipAddress: ipAddress || 'unknown',
          },
        });
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: COUNCIL_MESSAGE.COUNCIL_NOT_FOUND };
      }

      const updatedCouncil = await prisma.$transaction(async (tx) => {
        await tx.reviewSchedule.updateMany({
          where: { councilId, isDeleted: false },
          data: { isDeleted: true },
        });
        await tx.defenseSchedule.updateMany({
          where: { councilId, isDeleted: false },
          data: { isDeleted: true },
        });
        await tx.reviewAssignment.updateMany({
          where: { councilId, isDeleted: false },
          data: { isDeleted: true },
        });
        await tx.reviewDefenseCouncil.updateMany({
          where: { councilId, isDeleted: false },
          data: { isDeleted: true },
        });
        await tx.councilMember.updateMany({
          where: { councilId, isDeleted: false },
          data: { isDeleted: true },
        });
        await tx.document.updateMany({
          where: { councilId, isDeleted: false },
          data: { isDeleted: true },
        });
        await tx.council.update({
          where: { id: councilId },
          data: { isDeleted: true },
        });
        await tx.systemLog.create({
          data: {
            userId,
            action: 'DELETE_REVIEW_COUNCIL',
            entityType: 'Council',
            entityId: councilId,
            description: `Hội đồng xét duyệt "${council.name}" đã được đánh dấu xóa`,
            severity: 'INFO',
            ipAddress: ipAddress || 'unknown',
            metadata: { councilCode: council.code, councilName: council.name },
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
          action: 'DELETE_REVIEW_COUNCIL_ERROR',
          entityType: 'Council',
          entityId: councilId,
          description: 'Lỗi hệ thống khi đánh dấu xóa hội đồng xét duyệt',
          severity: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
          stackTrace: (error as Error).stack || 'No stack trace',
          ipAddress: ipAddress || 'unknown',
        },
      });
      console.error('Lỗi khi đánh dấu xóa hội đồng xét duyệt:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi hệ thống khi đánh dấu xóa hội đồng.' };
    }
  }

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

  async getCouncilDetailsForLecturer(councilId: string, userId: string) {
    try {
      const isMember = await prisma.councilMember.findFirst({
        where: { councilId, userId },
      });
      if (!isMember) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Bạn không phải thành viên của hội đồng này.",
        };
      }

      const council = await prisma.council.findUnique({
        where: { id: councilId },
        include: {
          members: {
            include: {
              user: { select: { id: true, fullName: true, email: true } },
              role: { select: { id: true, name: true } },
            },
          },
          semester: { select: { id: true, code: true, startDate: true, endDate: true } },
          submissionPeriod: { select: { id: true, roundNumber: true, startDate: true, endDate: true } },
        },
      });

      if (!council) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: COUNCIL_MESSAGE.COUNCIL_NOT_FOUND,
        };
      }

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


  // 
  async createReviewSchedule(data: {
    councilId: string;
    groups: { groupId: string; reviewTime: Date }[]; // Body nhận groupId thay vì topicId
    room: string;
    createdBy: string;
  }) {
    try {
      // 1. Lấy số lượng tối đa nhóm từ cấu hình
      const maxTopicsPerSchedule = await systemConfigService.getMaxTopicsPerCouncilSchedule();

      // 2. Kiểm tra số lượng nhóm
      if (data.groups.length < 1 || data.groups.length > maxTopicsPerSchedule) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: `Số lượng nhóm phải từ 1 đến ${maxTopicsPerSchedule}!`,
        };
      }

      // 3. Kiểm tra hội đồng tồn tại
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

      // 4. Kiểm tra trùng thời gian giữa các nhóm trong danh sách
      const reviewTimes = data.groups.map(g => g.reviewTime.getTime());
      const hasDuplicateTime = new Set(reviewTimes).size !== reviewTimes.length;
      if (hasDuplicateTime) {
        return {
          success: false,
          status: HTTP_STATUS.CONFLICT,
          message: "Có các nhóm trong danh sách bị trùng thời gian chấm điểm!",
        };
      }

      // 5. Kiểm tra trùng thời gian với các lịch khác của hội đồng
      const allSchedules = await prisma.reviewSchedule.findMany({
        where: {
          councilId: data.councilId,
          isDeleted: false,
        },
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

      // 6. Kiểm tra nhóm tồn tại và lấy thông tin đề tài từ TopicAssignment
      const groupIds = data.groups.map(g => g.groupId);
      const topicAssignments = await prisma.topicAssignment.findMany({
        where: {
          groupId: { in: groupIds },
          status: "ASSIGNED",
          isDeleted: false,
        },
        include: {
          topic: { select: { id: true, topicCode: true, status: true } },
        },
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

      // 7. Kiểm tra trạng thái đề tài
      const validStatuses = ["APPROVED", "SUBMITTED_FOR_REVIEW"];
      const invalidTopics = topicAssignments.filter(ta => !validStatuses.includes(ta.topic.status));
      if (invalidTopics.length > 0) {
        const invalidDetails = invalidTopics.map(ta => `${ta.topic.id} (${ta.topic.status})`);
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: `Các đề tài không ở trạng thái phù hợp để chấm: ${invalidDetails.join(", ")}!`,
        };
      }

      // 8. Kiểm tra đề tài đã được lên lịch bởi hội đồng khác chưa
      const topicIds = topicAssignments.map(ta => ta.topicId);
      const scheduledTopics = await prisma.reviewSchedule.findMany({
        where: {
          topicId: { in: topicIds },
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

      // 9. Kiểm tra mentor không trùng với thành viên hội đồng (dùng GroupMentor)
      const councilMemberIds = council.members.map(member => member.userId);
      const groupMentors = await prisma.groupMentor.findMany({
        where: {
          groupId: { in: groupIds },
          isDeleted: false,
        },
        include: {
          mentor: { select: { id: true, fullName: true, email: true } },
          group: { select: { groupCode: true } },
        },
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

      // 10. Tạo lịch chấm điểm và trả dữ liệu bao gồm groupCode, topicCode, và thành viên nhóm
      const newSchedules = await prisma.$transaction(
        data.groups.map(group => {
          const assignment = topicAssignments.find(ta => ta.groupId === group.groupId);
          return prisma.reviewSchedule.create({
            data: {
              councilId: data.councilId,
              topicId: assignment!.topicId, // Lấy topicId từ TopicAssignment
              groupId: group.groupId,
              reviewTime: group.reviewTime,
              room: data.room,
              reviewRound: 1,
              status: "PENDING",
              notes: null,
            },
            include: {
              topic: {
                select: {
                  topicCode: true,
                },
              },
              group: {
                select: {
                  groupCode: true,
                  members: {
                    where: { isDeleted: false },
                    include: {
                      user: { select: { fullName: true } },
                      student: { select: { studentCode: true } },
                    },
                  },
                },
              },
            },
          });
        })
      );

      return {
        success: true,
        status: HTTP_STATUS.CREATED,
        message: "Tạo lịch chấm điểm cho các nhóm thành công!",
        data: newSchedules,
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
  // API cho mentor xem lịch nhóm
  async getReviewScheduleForMentor(userId: string) {
    try {
      // 1. Lấy danh sách groupId mà user là mentor
      const mentorGroups = await prisma.groupMentor.findMany({
        where: {
          mentorId: userId,
          isDeleted: false,
        },
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

      // 2. Lấy lịch chấm điểm của các nhóm đó
      const schedules = await prisma.reviewSchedule.findMany({
        where: {
          groupId: { in: groupIds },
          isDeleted: false,
        },
        include: {
          topic: { select: { topicCode: true, name: true } },
          group: {
            select: {
              groupCode: true,
              members: {
                where: { isDeleted: false },
                include: { user: { select: { fullName: true } } },
              },
            },
          },
          council: { select: { name: true } },
        },
      });

      if (schedules.length === 0) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Hiện tại chưa có lịch chấm điểm nào cho các nhóm bạn phụ trách!",
        };
      }

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: "Lấy lịch chấm điểm thành công!",
        data: schedules,
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
  // API cho student xem lịch nhóm 
  async getReviewScheduleForStudent(userId: string) {
    try {
      // 1. Lấy học kỳ đang hoạt động
      const activeSemester = await prisma.semester.findFirst({
        where: { status: "active", isDeleted: false },
        orderBy: { startDate: 'desc' },
      });

      if (!activeSemester) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Hiện tại không có học kỳ nào đang hoạt động!",
        };
      }

      // 2. Lấy thông tin thành viên của sinh viên trong học kỳ hiện tại
      const groupMember = await prisma.groupMember.findFirst({
        where: {
          userId,
          isDeleted: false,
          group: { semesterId: activeSemester.id, isDeleted: false },
        },
        include: {
          group: {
            include: {
              members: { where: { isDeleted: false }, include: { user: { select: { fullName: true } } } },
            },
          },
        },
      });

      if (!groupMember) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Bạn hiện không thuộc nhóm nào trong kỳ hiện tại!",
        };
      }

      // 3. Kiểm tra trạng thái của chính sinh viên gọi API
      if (!groupMember.isActive) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Tài khoản của bạn hiện không hoạt động, vui lòng liên hệ quản lý để được hỗ trợ!",
        };
      }

      // 4. Lấy lịch chấm điểm của nhóm (không chặn nếu nhóm có thành viên INACTIVE khác)
      const schedules = await prisma.reviewSchedule.findMany({
        where: {
          groupId: groupMember.groupId,
          isDeleted: false,
        },
        include: {
          topic: { select: { topicCode: true, name: true } },
          group: {
            select: {
              groupCode: true,
              members: { where: { isDeleted: false }, include: { user: { select: { fullName: true } } } },
            },
          },
          council: { select: { name: true } },
        },
      });

      if (schedules.length === 0) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Nhóm của bạn hiện chưa có lịch chấm điểm nào!",
        };
      }

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: "Lấy lịch chấm điểm thành công!",
        data: schedules,
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
}



