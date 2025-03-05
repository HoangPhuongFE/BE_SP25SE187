import { Request, Response } from 'express';
import { TopicService } from '../service/topic.service';
import { TOPIC_MESSAGE } from '../constants/message';
import HTTP_STATUS from '../constants/httpStatus';

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
      draftFileUrl?: string; // URL file từ endpoint upload
    }> & { user?: { userId: string } },
    res: Response
  ) {
    try {
     // console.log(' Dữ liệu nhận được:', req.body);

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
        draftFileUrl, // Sử dụng URL file thay vì file object
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
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: TOPIC_MESSAGE.INVALID_REQUEST });
      }

      const { nameVi, nameEn, name, description, isBusiness, businessPartner, source, subSupervisor, subSupervisorEmail, groupId, groupCode, documents } = req.body;
      const updatedBy = req.user!.userId;
      
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
        documents,
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
      if (!semesterId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Thiếu ID học kỳ.' });
      }

      const result = await topicService.getTopicsBySemester(semesterId);
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
      const finalFile = req.file;
      const userId = req.user!.userId;

      if (!topicId || !status) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Thiếu ID đề tài hoặc trạng thái!' });
      }

      const result = await topicService.approveTopicByAcademic(topicId, status, userId, finalFile);
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
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Thiếu ID đề tài!' });
      }

      const result = await topicService.deleteTopic(topicId);
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

  async exportTopicsForApproval(req: Request, res: Response) {
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

      const topicsResult = await topicService.getTopicsForApprovalBySubmission(query);
      if (!topicsResult.success) {
        return res.status(topicsResult.status).json(topicsResult);
      }

      // Kiểm tra topicsResult.data có tồn tại không
      if (!topicsResult.data) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: 'Không có dữ liệu để xuất Excel!',
        });
      }

      const exportResult = await topicService.exportTopicsToExcel(topicsResult.data);
      if (!exportResult.success) {
        return res.status(exportResult.status).json(exportResult);
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=topics-for-approval.xlsx');
      res.send(exportResult.data);
    } catch (error) {
      console.error('Lỗi khi xuất danh sách đề tài:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi xuất danh sách đề tài!',
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
  async downloadDecisionFile(req: Request, res: Response) {
    try {
      const { decisionId, fileType } = req.query;
      if (!decisionId || !fileType) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Thiếu decisionId hoặc fileType!',
        });
      }

      const result = await topicService.downloadDecisionFile(decisionId as string, fileType as string);
      if (!result.success) {
        return res.status(result.status).json(result);
      }

      if (typeof result.data === 'string') {
        res.redirect(result.data); // fileUrl từ service
      } else {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: 'Invalid file URL!',
        });
      }
    } catch (error) {
      console.error('Lỗi khi tải file:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi tải file!',
      });
    }
  }
}