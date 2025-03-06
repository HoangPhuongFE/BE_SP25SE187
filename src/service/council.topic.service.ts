import { PrismaClient } from '@prisma/client';
import HTTP_STATUS from '../constants/httpStatus';
import COUNCIL_MESSAGE from '../constants/message';
import crypto from "crypto";
import { SubmissionPeriodService } from './submissionPeriod.service';
import { SystemConfigService } from './system.config.service';

const submissionPeriodService = new SubmissionPeriodService();
const prisma = new PrismaClient();
const systemConfigService = new SystemConfigService();

export class CouncilTopicService {

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
      // Kiểm tra học kỳ có tồn tại không
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

      // Kiểm tra đợt xét duyệt nếu có
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

      // Tạo mới hội đồng với các trường mở rộng
      const newCouncil = await prisma.council.create({
        data: {
          name: data.name,
          semesterId: data.semesterId,
          submissionPeriodId: data.submissionPeriodId || null,
          councilStartDate: data.startDate,
          councilEndDate: data.endDate,
          status: data.status || "ACTIVE",
          type: data.type || "topic", // Mặc định là hội đồng xét duyệt đề tài
          round: data.round || 1, // Nếu không có sẽ mặc định là round 1
          createdDate: new Date(),
        },
      });

      return {
        success: true,
        status: HTTP_STATUS.CREATED,
        message: "Tạo hội đồng thành công!",
        data: newCouncil,
      };
    } catch (error) {
      console.error("Lỗi khi tạo hội đồng:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống!",
      };
    }
  }

  // Lấy danh sách hội đồng topic
  async getTopicCouncils(filter: { semesterId?: string; submissionPeriodId?: string; round?: number }) {
    try {
      const { semesterId, submissionPeriodId, round } = filter;
      const councils = await prisma.council.findMany({
        where: {
          type: "topic",
          ...(semesterId && { semesterId }),
          ...(submissionPeriodId && { submissionPeriodId }),
          ...(round !== undefined && { round })
        },
        include: {
          members: {
            include: {
              user: { select: { id: true, fullName: true, email: true } }
            }
          }
        }
      });

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: COUNCIL_MESSAGE.COUNCIL_LIST_FETCHED,
        data: councils
      };
    } catch (error) {
      console.error("Lỗi khi lấy danh sách hội đồng topic:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: COUNCIL_MESSAGE.COUNCIL_LIST_FAILED
      };
    }
  }

  // Lấy chi tiết hội đồng topic theo id
  async getTopicCouncilById(councilId: string) {
    try {
      const council = await prisma.council.findUnique({
        where: { id: councilId },
        include: {
          members: {
            include: {
              user: { select: { id: true, fullName: true, email: true } }
            }
          }
        }
      });
      if (!council) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: COUNCIL_MESSAGE.COUNCIL_NOT_FOUND
        };
      }
      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: COUNCIL_MESSAGE.COUNCIL_FETCHED,
        data: council
      };
    } catch (error) {
      console.error("Lỗi khi lấy hội đồng topic:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: COUNCIL_MESSAGE.COUNCIL_LIST_FAILED
      };
    }
  }

  // Cập nhật hội đồng topic
  async updateTopicCouncil(councilId: string, data: {
    name?: string;
    code?: string;
    round?: number;
    status?: string;
    councilStartDate?: Date;
    councilEndDate?: Date;
  }) {
    try {
      // Cập nhật các trường cần thiết
      const updatedCouncil = await prisma.council.update({
        where: { id: councilId },
        data: {
          name: data.name,
          code: data.code,
          round: data.round,
          status: data.status,
          councilStartDate: data.councilStartDate,
          councilEndDate: data.councilEndDate
        }
      });

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: COUNCIL_MESSAGE.COUNCIL_UPDATED,
        data: updatedCouncil
      };
    } catch (error) {
      console.error("Lỗi khi cập nhật hội đồng topic:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: COUNCIL_MESSAGE.COUNCIL_UPDATE_FAILED
      };
    }
  }

  // Xóa hội đồng topic
  async deleteTopicCouncil(councilId: string) {
    try {
      // Kiểm tra xem hội đồng có tồn tại không
      const council = await prisma.council.findUnique({
        where: { id: councilId },
        include: { members: true }
      });

      if (!council) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: COUNCIL_MESSAGE.COUNCIL_NOT_FOUND
        };
      }

      // Kiểm tra nếu còn thành viên thì không cho xóa
      if (council.members.length > 0) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: "Không thể xóa hội đồng khi vẫn còn thành viên. Vui lòng xóa thành viên trước."
        };
      }

      await prisma.council.delete({
        where: { id: councilId }
      });

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: COUNCIL_MESSAGE.COUNCIL_DELETED
      };
    } catch (error) {
      console.error("Lỗi khi xóa hội đồng topic:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống khi xóa hội đồng."
      };
    }
  }
  async addMemberToCouncil(
    councilId: string,
    data: { email: string; role: string; addedBy: string }
  ) {
    try {
      // Kiểm tra hội đồng có tồn tại không
      const council = await prisma.council.findUnique({ where: { id: councilId } });
      if (!council) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Không tìm thấy hội đồng!",
        };
      }

      // Kiểm tra user có tồn tại không qua email
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
      

      // Kiểm tra vai trò của user có phải là lecturer không
      const userRole = await prisma.userRole.findFirst({
        where: { userId: user.id},
        include: { role: true },
      });

      if (!userRole) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Người này không phải là giảng viên!",
        };
      }

      // Kiểm tra số lượng thành viên tối đa trong hội đồng
      const maxCouncilMembers = await systemConfigService.getMaxCouncilMembers();
      const currentMemberCount = await prisma.councilMember.count({ where: { councilId } });

      if (currentMemberCount >= maxCouncilMembers) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: `Số lượng thành viên hội đồng đã đạt tối đa (${maxCouncilMembers})!`,
        };
      }

      // Kiểm tra xem thành viên đã có trong hội đồng chưa
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

      // Thêm thành viên vào hội đồng
      const newMember = await prisma.councilMember.create({
        data: {
          councilId,
          userId: user.id,
          role: data.role,
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

 
  async removeMemberFromCouncil(councilId: string, userId: string) {
    try {
      // Kiểm tra hội đồng có tồn tại không
      const council = await prisma.council.findUnique({ where: { id: councilId } });

      if (!council) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Không tìm thấy hội đồng!",
        };
      }

      // Kiểm tra xem thành viên có tồn tại không
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

      // Xóa thành viên khỏi hội đồng
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
}
