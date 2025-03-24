import { Request, Response } from 'express';
import HTTP_STATUS from '../constants/httpStatus';
import COUNCIL_MESSAGE from '../constants/message';
import { CouncilReviewService } from '../service/council.review.service';
import { AuthenticatedRequest } from '~/middleware/user.middleware';

const councilReviewService = new CouncilReviewService();

export class CouncilReviewController {
  async createCouncil(req: Request, res: Response) {
    const { name, semesterId, submissionPeriodId, startDate, endDate, status, type, round } = req.body;
    const createdBy = req.user!.userId;

    const result = await councilReviewService.createCouncil({
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
      const result = await councilReviewService.updateReviewCouncil(id, {
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
        message: COUNCIL_MESSAGE.COUNCIL_UPDATE_FAILED,
      });
    }
  }

  async getCouncils(req: AuthenticatedRequest, res: Response) {
    try {
      const { semesterId, submissionPeriodId, round } = req.query;
      const user = req.user; // Lấy thông tin user từ middleware authenticateToken
      const result = await councilReviewService.getReviewCouncils({
        semesterId: semesterId as string,
        submissionPeriodId: submissionPeriodId as string,
        round: round ? Number(round) : undefined,
        user, // Truyền user vào service
      });
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi trong getCouncils:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: COUNCIL_MESSAGE.COUNCIL_LIST_FAILED,
      });
    }
  }

  async getCouncilById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await councilReviewService.getReviewCouncilById(id);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi trong getCouncilById:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: COUNCIL_MESSAGE.COUNCIL_LIST_FAILED,
      });
    }
  }

  async deleteCouncil(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const ipAddress = req.ip;

      if (!userId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Không tìm thấy thông tin người dùng.',
        });
      }

      const result = await councilReviewService.deleteReviewCouncil(id, userId, ipAddress);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong deleteCouncil:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi đánh dấu xóa hội đồng.',
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

      const result = await councilReviewService.addMemberToCouncil(councilId, { email, role, addedBy });
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

      const result = await councilReviewService.removeMemberFromCouncil(councilId, userId);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi khi xóa thành viên:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Lỗi hệ thống!" });
    }
  }

  async getCouncilDetailsForLecturer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const result = await councilReviewService.getCouncilDetailsForLecturer(id, userId);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi trong getCouncilDetailsForLecturer:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: COUNCIL_MESSAGE.COUNCIL_LIST_FAILED,
      });
    }
  }


  async createReviewSchedule(req: Request, res: Response) {
    try {
      const { councilId, groups, room } = req.body; // Đổi topics thành groups
      const createdBy = req.user!.userId;

      const formattedGroups = groups.map((g: { groupId: string; reviewTime: string }) => ({
        groupId: g.groupId,
        reviewTime: new Date(g.reviewTime),
      }));

      const result = await councilReviewService.createReviewSchedule({
        councilId,
        groups: formattedGroups,
        room,
        createdBy,
      });

      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi trong createReviewSchedule:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi hệ thống khi tạo lịch chấm điểm!",
      });
    }
  }
  // API cho mentor xem lịch nhóm
  async getReviewScheduleForMentor(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const result = await councilReviewService.getReviewScheduleForMentor(userId);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi trong getReviewScheduleForMentor:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi hệ thống khi lấy lịch chấm điểm!",
      });
    }
  }

  // API cho student xem lịch nhóm
  async getReviewScheduleForStudent(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const result = await councilReviewService.getReviewScheduleForStudent(userId);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi trong getReviewScheduleForStudent:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi hệ thống khi lấy lịch chấm điểm!",
      });
    }
  }
}