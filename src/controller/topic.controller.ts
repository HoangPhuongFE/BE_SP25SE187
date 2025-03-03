import { Request, Response } from "express";
import { TopicService } from "../service/topic.service";
import { TOPIC_MESSAGE ,GROUP_MESSAGE } from "../constants/message";
import HTTP_STATUS from "../constants/httpStatus";
import { PrismaClient } from "@prisma/client";

const topicService = new TopicService();


export class TopicController {
  async createTopic(req: Request, res: Response) {
    try {
        // Lấy thông tin từ token
        const createdBy = req.user?.userId;
        const userRole = req.user?.role || "unknown";

        if (!createdBy) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: "Không xác định được thông tin người dùng!",
            });
        }

        const { 
            nameVi, nameEn, description, semesterId, majorId, isBusiness, 
            businessPartner, source, subSupervisor, subSupervisorEmail, name, 
            documents, groupId, groupCode 
        } = req.body;

        // Kiểm tra nếu `semesterId` không tồn tại
        if (!semesterId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "Thiếu `semesterId`, vui lòng kiểm tra request!",
            });
        }

        // Gọi Service xử lý logic
        const result = await topicService.createTopic({
            nameVi, nameEn, description, semesterId, majorId, isBusiness, 
            businessPartner, source, subSupervisor, subSupervisorEmail, name, 
            createdBy, userRole, documents, groupId, groupCode
        });

        return res.status(result.status).json(result);
    } catch (error) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: TOPIC_MESSAGE.TOPIC_CREATION_FAILED,
        });
    }
}



  

  async updateTopic(req: Request, res: Response) {
    try {
        const { topicId } = req.params; 
        const {
            nameVi,
            nameEn,
            name,
            description,
            isBusiness,
            businessPartner,
            source,
            subSupervisor,
            subSupervisorEmail,
            groupId,
            groupCode,
            documents
        } = req.body;

        if (!topicId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: TOPIC_MESSAGE.INVALID_REQUEST,
            });
        }

        const userRole = req.user!.role;

        const result = await topicService.updateTopic(
            topicId,
            {
                nameVi,
                nameEn,
                name,
                description,
                isBusiness,
                businessPartner,
                source,
                subSupervisor,
                subSupervisorEmail,
                groupId,
                groupCode,
                updatedBy: req.user!.userId,
                documents,
            },
            userRole
        );

        return res.status(result.status).json(result);
    } catch (error) {
        console.error(error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: TOPIC_MESSAGE.ACTION_FAILED,
        });
    }
}

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
    console.error(error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Lỗi khi lấy chi tiết đề tài.",
    });
  }
}


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
    console.error(error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Lỗi khi lấy danh sách đề tài.",
    });
  }
}


  //  Lấy danh sách đề tài có thể đăng ký
  async getAvailableTopics(req: Request, res: Response) {
    try {
      const result = await topicService.getAvailableTopics(req.query);
      return res.status(result.status).json(result);
    } catch (error) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Lỗi hệ thống!" });
    }
  }


  

//  Nhóm trưởng đăng ký đề tài
async registerTopic(req: Request, res: Response) {
  try {
      const leaderId = req.user?.userId;  // Lấy userId từ token
      const result = await topicService.registerTopic(req.body, leaderId);
      return res.status(result.status).json(result);
  } catch (error) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
          success: false, 
          message: "Lỗi hệ thống!" 
      });
  }
}

//  Mentor duyệt nhóm đăng ký đề tài
async approveTopicRegistration(req: Request, res: Response) {
  try {
      const mentorId = req.user?.userId;  // Lấy userId từ token
      const result = await topicService.approveTopicRegistration(req.body, mentorId);
      return res.status(result.status).json(result);
  } catch (error) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
          success: false, 
          message: "Lỗi hệ thống!" 
      });
  }
}



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
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Lỗi hệ thống!",
    });
  }
}




  //  Hội đồng xét duyệt cập nhật trạng thái đề tài
  async updateTopicStatus(req: Request, res: Response) {
    try {
      const result = await topicService.updateTopicStatus(req.params.topicId, req.body, req.user.userId,req.user.role);  // Lấy userId từ token
      return res.status(result.status).json(result);
    } catch (error) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Lỗi hệ thống!" });
    }
  }
  
 
    //  Xóa đề tài
    async deleteTopic(req: Request, res: Response) {
      try {
        const { topicId } = req.params;
        const userRole = req.user?.role;
        
        if (!topicId) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Thiếu topicId!" });
        }
  
        const result = await topicService.deleteTopic(topicId, userRole);
        return res.status(result.status).json(result);
        
      } catch (error) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Lỗi hệ thống!" });
      }
    }
}
