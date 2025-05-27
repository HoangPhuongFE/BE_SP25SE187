import { Request, Response } from 'express';
import HTTP_STATUS from '../constants/httpStatus';
import COUNCIL_MESSAGE from '../constants/message';
import { CouncilReviewService } from '../services/council.review.service';
import { AuthenticatedRequest } from '~/middleware/user.middleware';

const councilReviewService = new CouncilReviewService();

export class CouncilReviewController {
  // API 1: Tạo hội đồng (Giữ nguyên)
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

  // API: Cập nhật hội đồng (Giữ nguyên)
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

  // API: Lấy danh sách hội đồng (Giữ nguyên)
  async getCouncils(req: AuthenticatedRequest, res: Response) {
    try {
      const { semesterId, submissionPeriodId, round } = req.query;
      const user = req.user;
      const result = await councilReviewService.getReviewCouncils({
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
        message: COUNCIL_MESSAGE.COUNCIL_LIST_FAILED,
      });
    }
  }

  // API: Lấy chi tiết hội đồng theo ID (Giữ nguyên)
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

  // API: Xóa hội đồng (Giữ nguyên)
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

  // API 2: Thêm thành viên vào hội đồng (Giữ nguyên)
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

  // API: Xóa thành viên khỏi hội đồng (Giữ nguyên)
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

  // API: Lấy chi tiết hội đồng cho giảng viên (Giữ nguyên)
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

  // API 3: Tạo lịch chấm điểm (Giữ nguyên)
  async createReviewSchedule(req: Request, res: Response) {
    try {
      const { councilId, groups, room } = req.body;
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
        // reviewRound: 0
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

  // API 4: Student xem lịch nhóm (Chỉnh sửa để phù hợp với service)
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

  // API 5: Mentor xem lịch nhóm (Chỉnh sửa để phù hợp với service)
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

  // API 6: Leader thêm URL (API mới)
  async addUrlToReviewSchedule(req: Request, res: Response) {
    try {
      const { scheduleId } = req.params;
      const { url } = req.body;
      const userId = req.user!.userId;

      if (!scheduleId || !url) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Thiếu scheduleId hoặc url!",
        });
      }

      const result = await councilReviewService.addUrlToReviewSchedule(scheduleId, url, userId);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi trong addUrlToReviewSchedule:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi hệ thống khi thêm URL!",
      });
    }
  }

  // API 7: Hội đồng cập nhật trạng thái, note, điểm số (API mới)
  async updateReviewAssignment(req: Request, res: Response) {
    try {
      const { assignmentId } = req.params;
      const { score, feedback, status } = req.body;
      const userId = req.user!.userId;

      if (!assignmentId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Thiếu assignmentId!",
        });
      }

      const result = await councilReviewService.updateReviewAssignment(assignmentId, { score, feedback, status }, userId);
      return res.status(result.status).json(result);
    } catch (error) {
      //console.error("Lỗi trong updateReviewAssignment:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi hệ thống khi cập nhật assignment!",
      });
    }
  }

  // API: Hội đồng cập nhật trạng thái của ReviewSchedule (hỗ trợ groupId hoặc groupCode) (API mới)
  async updateReviewSchedule(req: Request, res: Response) {
    const { scheduleId } = req.params;
    const { status, room, reviewTime, note, groupId, groupCode } = req.body; 
    const userId = req.user?.userId;

    const result = await councilReviewService.updateReviewSchedule(
      scheduleId,
      { status, room, reviewTime: reviewTime ? new Date(reviewTime) : undefined, note, groupId, groupCode }, 
      userId
    );

    return res.status(result.status).json(result);
  }


  async confirmDefenseRound(req: Request, res: Response) {
    try {
      const { groupCode, defenseRound, mentorDecision } = req.body;
  
      // Kiểm tra dữ liệu đầu vào bắt buộc
      if (!groupCode || !mentorDecision) {
        return res.status(400).json({
          success: false,
          message: "Thiếu groupCode hoặc mentorDecision!",
        });
      }
  
      // Nếu mentorDecision là "PASS", kiểm tra defenseRound
      if (mentorDecision === "PASS") {
        if (defenseRound !== 1 && defenseRound !== 2) {
          return res.status(400).json({
            success: false,
            message: "defenseRound phải là 1 hoặc 2 khi mentorDecision là PASS!",
          });
        }
      }
  
      // Nếu mentorDecision là "NOT_PASS", defenseRound phải là null hoặc undefined (không gửi)
      if (mentorDecision === "NOT_PASS" && defenseRound !== null && defenseRound !== undefined) {
        return res.status(400).json({
          success: false,
          message: "Khi mentorDecision là NOT_PASS, defenseRound phải là null hoặc không được gửi!",
        });
      }
  
      // Gọi service để xử lý
      const userId = req.user!.userId;
      const result = await councilReviewService.confirmDefenseRound(
        groupCode,
        defenseRound, // Có thể là undefined khi NOT_PASS
        userId,
        mentorDecision
      );
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi trong controller confirmDefenseRound:", error);
      return res.status(500).json({
        success: false,
        message: "Lỗi hệ thống khi xác nhận vòng bảo vệ!",
      });
    }
  }
}