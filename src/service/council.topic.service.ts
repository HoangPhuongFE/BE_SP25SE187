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

      // Tính trạng thái dựa trên thời gian
      const now = new Date();
      let computedStatus = data.status || "ACTIVE";
      if (now < data.startDate) {
        computedStatus = "UPCOMING";
      } else if (now >= data.startDate && now <= data.endDate) {
        computedStatus = "ACTIVE";
      } else {
        computedStatus = "COMPLETE";
      }

      // Tạo council_code dựa trên type, round và mã học kỳ
      // Ví dụ: nếu type = "topic", round = 1 và semester.code = "SP25SE187" thì council_code sẽ là "TOPIC-1-SP25SE187"
      const councilCode = `${(data.type || "topic").toUpperCase()}-${data.round || 1}-${semester.code}`;

      // Tạo mới hội đồng với các trường mở rộng
      const newCouncil = await prisma.council.create({
        data: {
          name: data.name,
          semesterId: data.semesterId,
          submissionPeriodId: data.submissionPeriodId || null,
          councilStartDate: data.startDate,
          councilEndDate: data.endDate,
          status: computedStatus,
          type: data.type || "topic",
          round: data.round || 1,
          createdDate: new Date(),
          code: councilCode,
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

  // Cập nhật hội đồng topic: cập nhật các trường cùng với việc tính lại trạng thái nếu thay đổi thời gian
  async updateTopicCouncil(councilId: string, data: {
    name?: string;
    code?: string;
    round?: number;
    status?: string;
    councilStartDate?: Date;
    councilEndDate?: Date;
  }) {
    try {
      // Nếu cập nhật thời gian, tính lại trạng thái dựa trên thời gian hiện tại
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

      // Cập nhật hội đồng với các trường mới
      const updatedCouncil = await prisma.council.update({
        where: { id: councilId },
        data: updateData,
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
  
      // Thu thập tất cả roleId từ các thành viên
      const roleIds = councils
        .flatMap(council => council.members.map(member => member.roleId))
        .filter((id, index, self) => self.indexOf(id) === index); // Loại bỏ trùng lặp
  
      // Truy vấn bảng role để lấy thông tin vai trò
      const roles = await prisma.role.findMany({
        where: { id: { in: roleIds } },
        select: { id: true, name: true }
      });
  
      // Tạo map để tra cứu tên vai trò nhanh chóng
      const roleMap = new Map(roles.map(role => [role.id, role.name]));
  
      // Thêm roleName vào mỗi thành viên trong danh sách hội đồng
      const councilsWithRoleNames = councils.map(council => ({
        ...council,
        members: council.members.map(member => ({
          ...member,
          roleName: roleMap.get(member.roleId) || "Không xác định"
        }))
      }));
  
      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: COUNCIL_MESSAGE.COUNCIL_LIST_FETCHED,
        data: councilsWithRoleNames
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
          status: HTTP_STATUS.OK,
          message: COUNCIL_MESSAGE.COUNCIL_NOT_FOUND
        };
      }
  
      // Thu thập tất cả roleId từ các thành viên
      const roleIds = council.members.map(member => member.roleId);
  
      // Truy vấn bảng role để lấy thông tin vai trò
      const roles = await prisma.role.findMany({
        where: { id: { in: roleIds } },
        select: { id: true, name: true }
      });
  
      // Tạo map để tra cứu tên vai trò
      const roleMap = new Map(roles.map(role => [role.id, role.name]));
  
      // Thêm roleName vào mỗi thành viên
      const councilWithRoleNames = {
        ...council,
        members: council.members.map(member => ({
          ...member,
          roleName: roleMap.get(member.roleId) || "Không xác định"
        }))
      };
  
      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: COUNCIL_MESSAGE.COUNCIL_FETCHED,
        data: councilWithRoleNames
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

      // Kiểm tra vai trò của user có phải là giảng viên không
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

      // Kiểm tra xem sinh viên đã tham gia hội đồng nào có thời gian giao nhau hay không (trừ hội đồng hiện tại)
      const overlappingCouncil = await prisma.council.findFirst({
        where: {
          id: { not: councilId },
          AND: [
            { councilStartDate: { lt: council.councilEndDate! } },
            { councilEndDate: { gt: council.councilStartDate! } },
          ],
          members: {
            some: {
              userId: user.id,
            },
          },
        },
      });

      if (overlappingCouncil) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: ` Giảng viên đã tham gia hội đồng "${overlappingCouncil.name}" (code: ${overlappingCouncil.code}) có lịch họp từ ${overlappingCouncil.councilStartDate!.toISOString()} đến ${overlappingCouncil.councilEndDate!.toISOString()}, không thể tham gia hội đồng mới có thời gian giao nhau.`,
        };
      }


      // *** Kết thúc kiểm tra xung đột thời gian ***

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

      // Lấy roleId từ bảng Role dựa trên name
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

      // Thêm thành viên vào hội đồng với roleId
      const newMember = await prisma.councilMember.create({
        data: {
          councilId,
          userId: user.id,
          roleId: role.id, // Sử dụng roleId thay vì role
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

  // Xóa hội đồng topic, kể cả khi vẫn còn thành viên
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

      // Sử dụng transaction để xóa cascade các thành viên và sau đó xóa hội đồng
      await prisma.$transaction([
        prisma.councilMember.deleteMany({ where: { councilId } }),
        prisma.council.delete({ where: { id: councilId } })
      ]);

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
