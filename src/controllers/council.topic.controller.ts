import { Request, Response } from 'express';
import HTTP_STATUS from '../constants/httpStatus';
import COUNCIL_MESSAGE from '../constants/message';
import { CouncilTopicService } from '../services/council.topic.service';

const councilTopicService = new CouncilTopicService();

export class CouncilTopicController {
  [x: string]: any;

  async createCouncil(req: Request, res: Response) {
    const { name, semesterId, submissionPeriodId, startDate, endDate, status, type, round } = req.body;
    const createdBy = req.user!.userId;

    const result = await councilTopicService.createCouncil({
      name,
      semesterId,
      submissionPeriodId,
      createdBy,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status,
      type,
      round,
    });

    return res.status(result.status).json(result);
  }

  async updateCouncil(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, code, round, status, councilStartDate, councilEndDate } = req.body;
      const result = await councilTopicService.updateTopicCouncil(id, {
        name,
        code,
        round,
        status,
        councilStartDate: councilStartDate ? new Date(councilStartDate) : undefined,
        councilEndDate: councilEndDate ? new Date(councilEndDate) : undefined,
      });
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi trong updateCouncil:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: COUNCIL_MESSAGE.COUNCIL_UPDATE_FAILED
      });
    }
  }

  async getCouncils(req: Request, res: Response) {
    try {
      const { semesterId, submissionPeriodId, round } = req.query;
      const user = req.user;
      const result = await councilTopicService.getTopicCouncils({
        semesterId: semesterId as string,
        submissionPeriodId: submissionPeriodId as string,
        round: round ? Number(round) : undefined,
        user,
      });
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi trong getCouncils:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: COUNCIL_MESSAGE.COUNCIL_LIST_FAILED
      });
    }
  }

  async getCouncilById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await councilTopicService.getTopicCouncilById(id);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi trong getCouncilById:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: COUNCIL_MESSAGE.COUNCIL_LIST_FAILED
      });
    }
  }

  async deleteCouncil(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const ipAddress = req.ip;

      if (!userId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Không tìm thấy thông tin người dùng.' });
      }

      const result = await councilTopicService.deleteTopicCouncil(id, userId, ipAddress);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong deleteCouncil:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi đánh dấu xóa hội đồng.'
      });
    }
  }

  async addMemberToCouncil(req: Request, res: Response) {
    try {
      const { councilId } = req.params;
      const { email, role } = req.body;
      const addedBy = req.user!.userId;

      if (!councilId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Thiếu councilId!" });
      }

      const result = await councilTopicService.addMemberToCouncil(councilId as string, { email, role, addedBy });
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi khi thêm thành viên vào hội đồng:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Lỗi hệ thống!" });
    }
  }

  async removeMemberFromCouncil(req: Request, res: Response) {
    try {
      const { councilId, userId } = req.params;

      if (!councilId || !userId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Thiếu councilId hoặc userId!" });
      }

      const result = await councilTopicService.removeMemberFromCouncil(councilId as string, userId as string);
      return res.status(result.status).json(result);
    } catch (error) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Lỗi hệ thống!" });
    }
  }

  async getCouncilDetailsForLecturer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const result = await councilTopicService.getCouncilDetailsForLecturer(id, userId);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi trong getCouncilDetailsForLecturer:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: COUNCIL_MESSAGE.COUNCIL_LIST_FAILED
      });
    }
  }

  async reviewTopicByCouncilMember(req: Request, res: Response) {
    try {
      const { topicId } = req.params;
      const { status, reviewReason } = req.body;
      const userId = req.user!.userId;

      if (!userId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          status: HTTP_STATUS.UNAUTHORIZED,
          message: 'Bạn cần đăng nhập để thực hiện hành động này!'
        });
      }

      const result = await councilTopicService.reviewTopicByCouncilMember(topicId, status, userId, reviewReason);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong controller khi duyệt đề tài:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống trong controller!'
      });
    }
  }

  async getTopicsForApproval(req: Request, res: Response) {
    try {
      const { submissionPeriodId, round, semesterId } = req.query;
      const userId = req.user!.userId;

      const result = await councilTopicService.getTopicsForApprovalBySubmission(
        {
          submissionPeriodId: submissionPeriodId as string,
          round: round ? Number(round) : undefined,
          semesterId: semesterId as string,
        },
        userId
      );

      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong getTopicsForApproval:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi lấy danh sách đề tài cần duyệt!'
      });
    }
  }
}