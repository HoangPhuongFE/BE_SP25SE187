import { Request, Response } from 'express';
import { TopicService } from '../service/topic.service';
import { TOPIC_MESSAGE } from '../constants/message';
import HTTP_STATUS from '../constants/httpStatus';
import { ParsedQs } from 'qs';

const topicService = new TopicService();

export class TopicController {
  async createTopic(
    req: Request<any, any, {
      nameVi: string;
      nameEn: string;
      description: string;
      semesterId: string;
      majorId: string;
      isBusiness?: string | boolean;
      businessPartner?: string;
      source?: string;
      subSupervisor?: string;
      subSupervisorEmail?: string;
      name: string;
      groupId?: string;
      groupCode?: string;
      draftFileUrl?: string;
    }> & { user?: { userId: string } },
    res: Response
  ) {
    try {
      const createdBy = req.user?.userId;
      if (!createdBy) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Không xác định được người dùng!',
          status: HTTP_STATUS.UNAUTHORIZED,
        });
      }

      const {
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
        groupId,
        groupCode,
        draftFileUrl,
      } = req.body;

      const result = await topicService.createTopic({
        nameVi,
        nameEn,
        description,
        semesterId,
        majorId,
        isBusiness: isBusiness === 'true' || isBusiness === true,
        businessPartner,
        source,
        subSupervisor,
        subSupervisorEmail,
        name,
        createdBy,
        draftFileUrl,
        groupId,
        groupCode,
      });

      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong createTopic:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi tạo đề tài!',
      });
    }
  }

  async updateTopic(req: Request, res: Response) {
    try {
      const { topicId } = req.params;
      if (!topicId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: TOPIC_MESSAGE.INVALID_ID
        });
      }

      const updatedBy = req.user?.userId;
      if (!updatedBy) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: TOPIC_MESSAGE.UNAUTHORIZED,
        });
      }

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
        semesterId,
        documents
      } = req.body;

      // Kiểm tra các trường bắt buộc
      if (!nameVi || !nameEn || !name || !description) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: TOPIC_MESSAGE.INVALID_REQUEST,
          details: 'Thiếu thông tin bắt buộc cho đề tài'
        });
      }

      // Nếu là đề tài doanh nghiệp thì phải có thông tin doanh nghiệp
      if (isBusiness && !businessPartner) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: TOPIC_MESSAGE.INVALID_BUSINESS_INFO
        });
      }

      // Gọi service để cập nhật đề tài
      const result = await topicService.updateTopic(topicId, {
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
        updatedBy,
        semesterId,
        documents
      });

      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi khi cập nhật đề tài:', error);
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
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Thiếu ID đề tài.' });
      }

      const result = await topicService.getTopicById(topicId);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi khi lấy chi tiết đề tài:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi khi lấy chi tiết đề tài.',
      });
    }
  }

  async getTopicsBySemester(req: Request, res: Response) {
    try {
      const { semesterId } = req.params;
      const { round } = req.query;
      if (!semesterId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Thiếu ID học kỳ.' });
      }

      const result = await topicService.getTopicsBySemester(semesterId, round ? Number(round) : undefined);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi khi lấy danh sách đề tài:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi khi lấy danh sách đề tài.',
      });
    }
  }

  async approveTopicByAcademic(req: Request, res: Response) {
    try {
      const { topicId } = req.params;
      const { status } = req.body;
      const reviewReason = req.body.reviewReason;
      const userId = req.user!.userId;

      if (!topicId || !status) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Thiếu ID đề tài hoặc trạng thái!' });
      }

      const result = await topicService.approveTopicByAcademic(topicId, status, userId, reviewReason);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi khi duyệt đề tài:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi duyệt đề tài!',
      });
    }
  }

  async approveTopicRegistrationByMentor(req: Request, res: Response) {
    try {
      const { registrationId } = req.params;
      const { status, reason } = req.body;
      if (!registrationId || !status) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: !registrationId ? 'Thiếu ID đăng ký!' : 'Thiếu trạng thái để duyệt!',
        });
      }

      const userId = req.user!.userId;
      const result = await topicService.approveTopicRegistrationByMentor(registrationId, { status, reason }, userId);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi khi duyệt đăng ký đề tài:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi duyệt đăng ký đề tài!',
      });
    }
  }

  async deleteTopic(req: Request, res: Response) {
    try {
      const { topicId } = req.params;
      if (!topicId) {
        return res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json({ success: false, message: 'Thiếu ID đề tài!' });
      }
      const isSystemWide = req.user.roles.some((role: { isSystemWide: any; }) => role.isSystemWide);
      const userId = req.user.userId; // Lấy userId từ thông tin đăng nhập

      const result = await topicService.deleteTopic(topicId, isSystemWide, userId);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi khi xóa đề tài:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi xóa đề tài!',
      });
    }
  }



  async registerTopic(req: Request, res: Response) {
    try {
      const leaderId = req.user?.userId;
      if (!leaderId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Không tìm thấy thông tin người dùng!' });
      }

      const { topicId, topicCode } = req.body;
      if (!topicId && !topicCode) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Thiếu topicId hoặc topicCode!' });
      }

      const result = await topicService.registerTopic({ topicId, topicCode }, leaderId);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi khi đăng ký đề tài:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi đăng ký đề tài!',
      });
    }
  }

  async getAvailableTopics(req: Request, res: Response) {
    try {
      const { semesterId, status } = req.query;
      const filter = { semesterId: semesterId as string, status: status as string };
      const result = await topicService.getAvailableTopics(filter);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi khi lấy danh sách đề tài khả dụng:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi lấy danh sách đề tài khả dụng!',
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
          message: 'Thiếu submissionPeriodId hoặc round và semesterId!',
        });
      }

      const result = await topicService.getTopicsForApprovalBySubmission(query);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi khi lấy danh sách đề tài cần duyệt:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi lấy danh sách đề tài cần duyệt!',
      });
    }
  }



  async getRegisteredTopicsByMentor(req: Request, res: Response) {
    try {
      const mentorId = req.user?.userId;
      if (!mentorId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Không tìm thấy thông tin người dùng!' });
      }

      const result = await topicService.getRegisteredTopicsByMentor(mentorId);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi khi lấy danh sách đề tài đã đăng ký:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi lấy danh sách đề tài đã đăng ký!',
      });
    }
  }



  async getTopicRegistrations(req: Request, res: Response) {
    try {
      const { topicId } = req.params; // Lấy topicId từ URL
      const { semesterId } = req.query; // Lấy semesterId từ query (nếu có)
      const mentorId = req.user?.userId; // Lấy userId từ thông tin người dùng đã xác thực

      // Kiểm tra xem người dùng đã đăng nhập chưa
      if (!mentorId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập!',
        });
      }

      // Nếu có semesterId, kiểm tra vai trò lecturer cho học kỳ đó
      if (semesterId) {
        const userRoles = req.user?.roles || [];
        const hasLecturerRole = userRoles.some(
          (role: { name: string; semesterId: string | ParsedQs | (string | ParsedQs)[]; }) => role.name === 'lecturer' && role.semesterId === semesterId
        );
        if (!hasLecturerRole) {
          return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: 'Bạn không có quyền truy cập cho học kỳ này!',
          });
        }
      }

      // Gọi service để lấy danh sách đăng ký
      const result = await topicService.getTopicRegistrations(topicId, mentorId);

      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong controller getTopicRegistrations:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi lấy danh sách đăng ký đề tài!',
      });
    }
  }



  async getAllRegistrations(req: Request, res: Response) {
    try {
      const result = await topicService.getAllRegistrations();
      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong controller getAllRegistrations:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi hệ thống khi lấy danh sách đăng ký!',
      });
    }
  }


  async getGroupRegistrations(req: Request, res: Response) {
    try {
      const { groupId } = req.params; // Lấy groupId từ URL
      const semesterId = req.query.semesterId as string; // Lấy semesterId từ query
      const userId = (req as any).user.userId; // Lấy userId từ thông tin xác thực

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập!',
        });
      }

      const result = await topicService.getGroupRegistrations(groupId, userId, semesterId);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong controller getGroupRegistrations:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi hệ thống khi lấy thông tin đăng ký của nhóm!',
      });
    }
  }


  // Lấy danh sách đề tài đã duyệt cho nhóm sinh viên 
  async getApprovedTopicsFortudent(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập!',
        });
      }

      // Gọi service mà không cần truyền semesterId
      const result = await topicService.getApprovedTopicsForStudent(userId);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong getApprovedTopicsForStudent:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi lấy danh sách đề tài đã duyệt!',
      });
    }
  }



  // Lấy danh sách tất cả  đề tài đã duyệt cho sinh viên xem 
  async getAllApprovedTopicsForStudent(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập!',
        });
      }

      const result = await topicService.getAllApprovedTopicsForStudent(userId);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong getAllApprovedTopicsForStudent:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi lấy danh sách tất cả đề tài đã duyệt!',
      });
    }
  }


  async createTopicWithMentors(
    req: Request<
      any,
      any,
      {
        nameVi: string;
        nameEn: string;
        description: string;
        semesterId: string;
        majorId: string;
        isBusiness?: string | boolean;
        businessPartner?: string;
        source?: string;
        mainMentorId?: string;
        subMentorId?: string;
        draftFileUrl?: string;
        groupId?: string;
        groupCode?: string;
      }
    > & { user?: { userId: string } },
    res: Response
  ) {
    try {
      const createdBy = req.user?.userId;
      if (!createdBy) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Không xác định được người dùng!',
          status: HTTP_STATUS.UNAUTHORIZED,
        });
      }

      const {
        nameVi,
        nameEn,
        description,
        semesterId,
        majorId,
        isBusiness,
        businessPartner,
        source,
        mainMentorId,
        subMentorId,
        draftFileUrl,
        groupId,
        groupCode,
      } = req.body;

      // Kiểm tra các trường bắt buộc
      if (!nameVi || !nameEn || !description || !semesterId || !majorId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Thiếu thông tin bắt buộc: nameVi, nameEn, description, semesterId, hoặc majorId!',
          status: HTTP_STATUS.BAD_REQUEST,
        });
      }

      const result = await topicService.createTopicWithMentors({
        nameVi,
        nameEn,
        description,
        semesterId,
        majorId,
        isBusiness: isBusiness === 'true' || isBusiness === true,
        businessPartner,
        source,
        mainMentorId,
        subMentorId,
        createdBy,
        draftFileUrl,
        groupId,
        groupCode,
      });

      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong createTopicWithMentors:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi tạo đề tài với mentor!',
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      });
    }
  }


  // API gán mentor hoặc nhóm vào đề tài
  async assignMentorsOrGroup(req: Request, res: Response) {
    const { topicId } = req.params;
    const { mainMentorEmail, subMentorEmail, groupId, groupCode, semesterId } = req.body;
  
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          success: false,
          message: 'Không thể xác định người dùng từ token!',
        });
      }
  
      const result = await topicService.assignMentorsOrGroupToTopic(
        topicId,
        {
          mainMentorEmail,
          subMentorEmail,
          groupId,
          groupCode,
          semesterId,
        },
        req.user.userId // Truyền updatedBy riêng
      );
  
      if (!result.success) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
        });
      }
  
      return res.status(200).json({
        success: true,
        message: result.message,
        data: result.data,
      });
    } catch (error) {
      console.error('Lỗi trong assignMentorsOrGroup:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi hệ thống.',
      });
    }
  }
}

