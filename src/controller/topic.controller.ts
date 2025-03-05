import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { TopicService } from "../service/topic.service";
import { TOPIC_MESSAGE, GROUP_MESSAGE } from "../constants/message";
import HTTP_STATUS from "../constants/httpStatus";

const prisma = new PrismaClient();
const topicService = new TopicService();

export class TopicController {
  // Tạo đề tài mới (Mentor hoặc Admin)
  async createTopic(req: Request, res: Response) {
    try {
      const createdBy = req.user?.userId;
      if (!createdBy) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: "Không xác định được thông tin người dùng!",
        });
      }

      const userRoles = await prisma.userRole.findMany({
        where: { userId: createdBy, isActive: true },
        include: { role: true },
      });
      const userRoleNames = userRoles.map(ur => ur.role.name);
      const userRole = userRoleNames[0]; // Lấy vai trò đầu tiên nếu cần

      const { nameVi, nameEn, description, semesterId, majorId, isBusiness, businessPartner, source, subSupervisor, subSupervisorEmail, name, documents, groupId, groupCode } = req.body;
      if (!semesterId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Thiếu `semesterId`, vui lòng kiểm tra request!",
        });
      }

      const result = await topicService.createTopic({
        nameVi,
        nameEn,
        description,
        semesterId,
        majorId,
        isBusiness,
        businessPartner,
        source,
        subSupervisor,
        subSupervisorEmail,
        name,
        createdBy,
        userRole,
        documents,
        groupId,
        groupCode,
      });
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi khi tạo đề tài:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: TOPIC_MESSAGE.TOPIC_CREATION_FAILED,
      });
    }
  }
  // Cập nhật đề tài
  async updateTopic(req: Request, res: Response) {
    try {
      const { topicId } = req.params;
      if (!topicId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: TOPIC_MESSAGE.INVALID_REQUEST,
        });
      }

      const { nameVi, nameEn, name, description, isBusiness, businessPartner, source, subSupervisor, subSupervisorEmail, groupId, groupCode, documents } = req.body;
      const userRole = req.user!.role;
      const updatedBy = req.user!.userId;

      const result = await topicService.updateTopic(
        topicId,
        { nameVi, nameEn, name, description, isBusiness, businessPartner, source, subSupervisor, subSupervisorEmail, groupId, groupCode, updatedBy, documents },
        userRole
      );
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi khi cập nhật đề tài:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: TOPIC_MESSAGE.ACTION_FAILED,
      });
    }
  }

  // Lấy chi tiết đề tài
  async getTopicById(req: Request, res: Response) {
    try {
      const { topicId } = req.params;
      if (!topicId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Thiếu ID đề tài.",
        });
      }

      const result = await topicService.getTopicById(topicId);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi khi lấy chi tiết đề tài:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi khi lấy chi tiết đề tài.",
      });
    }
  }

  // Lấy danh sách đề tài theo học kỳ
  async getTopicsBySemester(req: Request, res: Response) {
    try {
      const { semesterId } = req.params;
      if (!semesterId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Thiếu ID học kỳ.",
        });
      }

      const result = await topicService.getTopicsBySemester(semesterId);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi khi lấy danh sách đề tài:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi khi lấy danh sách đề tài.",
      });
    }
  }


  // Mentor duyệt đăng ký đề tài
  async approveTopicRegistrationByMentor(req: Request, res: Response) {
    try {
      const { registrationId } = req.params;
      const { status, reason } = req.body;
      if (!registrationId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Thiếu ID đăng ký!",
        });
      }
      if (!status) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Thiếu trạng thái để duyệt!",
        });
      }

      // Lấy roleId từ req.user.roles
      const userRoleIds = req.user!.roles || [];
      if (!userRoleIds.length) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: "Không có vai trò nào được gán cho người dùng!",
        });
      }

      // Tra cứu tên vai trò từ bảng UserRole và Role
      const userRoleRecord = await prisma.userRole.findFirst({
        where: {
          userId: req.user!.userId,
          roleId: { in: userRoleIds },
          isActive: true,
        },
        include: {
          role: {
            select: { name: true },
          },
        },
      });

      const userRole = userRoleRecord?.role.name;
      if (!userRole) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: "Không tìm thấy vai trò hợp lệ cho người dùng!",
        });
      }

      const result = await topicService.approveTopicRegistrationByMentor(
        registrationId,
        { status, reason },
        req.user!.userId,
        userRole
      );
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi khi duyệt đăng ký đề tài:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi hệ thống khi duyệt đăng ký đề tài!",
      });
    }
  }

  // Academic Officer duyệt đề tài
  async approveTopicByAcademic(req: Request, res: Response) {
    try {
      const { topicId } = req.params;
      const { status } = req.body;
      
      if (!topicId || !status) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Thiếu ID đề tài hoặc trạng thái!",
        });
      }
      
      const userId = req.user!.userId;
      const userRoles = await prisma.userRole.findMany({
        where: { userId, isActive: true },
        include: { role: true },
      });
      const userRoleNames = userRoles.map(ur => ur.role.name);

      const result = await topicService.approveTopicByAcademic(topicId, status, userId, userRoleNames[0]);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi khi duyệt đề tài:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi hệ thống khi duyệt đề tài!",
      });
    }
  }
  // Xóa đề tài
  async deleteTopic(req: Request, res: Response) {
    try {
      const { topicId } = req.params;
      if (!topicId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Thiếu ID đề tài!",
        });
      }

      const userRole = req.user!.role;
      const result = await topicService.deleteTopic(topicId, userRole);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi khi xóa đề tài:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi hệ thống khi xóa đề tài!",
      });
    }
  }
   // Nhóm trưởng đăng ký đề tài
   async registerTopic(req: Request, res: Response) {
    try {
      const leaderId = req.user?.userId;
      if (!leaderId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: "Không tìm thấy thông tin người dùng!",
        });
      }

      const { topicId, topicCode } = req.body;
      if (!topicId && !topicCode) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Thiếu topicId hoặc topicCode để đăng ký!",
        });
      }

      const result = await topicService.registerTopic({ topicId, topicCode }, leaderId);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi khi đăng ký đề tài:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi hệ thống khi đăng ký đề tài!",
      });
    }
  }

  // Lấy danh sách đề tài khả dụng cho sinh viên đăng ký
  async getAvailableTopics(req: Request, res: Response) {
    try {
      console.log("Nhận request getAvailableTopics - query:", req.query);
      const { semesterId, status } = req.query;
      const filter = { semesterId: semesterId as string, status: status as string };
      console.log("Filter gửi đến TopicService:", filter);
      const result = await topicService.getAvailableTopics(filter);
      console.log("Kết quả từ TopicService:", result);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi khi lấy danh sách đề tài khả dụng:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi hệ thống khi lấy danh sách đề tài khả dụng!",
      });
    }
  }

 
  // Lấy danh sách đề tài cần duyệt của hội đồng
  async getTopicsForApprovalBySubmission(req: Request, res: Response) {
    try {
      const { submissionPeriodId, round, semesterId } = req.query;
      const query = {
        submissionPeriodId: submissionPeriodId as string | undefined,
        round: round ? Number(round) : undefined,
        semesterId: semesterId as string | undefined,
      };
      if (!query.submissionPeriodId && (query.round === undefined || !query.semesterId)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Thiếu submissionPeriodId hoặc round và semesterId!",
        });
      }

      const result = await topicService.getTopicsForApprovalBySubmission(query);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi khi lấy danh sách đề tài cần duyệt:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi hệ thống khi lấy danh sách đề tài cần duyệt!",
      });
    }
  }

  async getRegisteredTopicsByMentor(req: Request, res: Response) {
    try {
      const mentorId = req.user?.userId; // Lấy ID của mentor từ token
      if (!mentorId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: "Không tìm thấy thông tin người dùng!",
        });
      }
  
      const result = await topicService.getRegisteredTopicsByMentor(mentorId);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("❌ Lỗi khi lấy danh sách đề tài đã đăng ký:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi hệ thống khi lấy danh sách đề tài đã đăng ký!",
      });
    }
  }
  
}