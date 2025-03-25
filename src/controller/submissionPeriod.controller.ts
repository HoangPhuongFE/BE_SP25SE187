import { Request, Response } from "express";
import { SubmissionPeriodService } from "../service/submissionPeriod.service";
import HTTP_STATUS from "../constants/httpStatus";

const service = new SubmissionPeriodService();

export class SubmissionPeriodController {
  async createSubmissionPeriod(req: Request, res: Response) {
    const { semesterId, roundNumber, startDate, endDate, description } = req.body;
    const createdBy = req.user!.userId;

    const result = await service.createSubmissionPeriod({ semesterId, roundNumber, startDate, endDate, description, createdBy });

    return res.status(result.status).json(result);
  }

  async updateSubmissionPeriod(req: Request, res: Response) {
    const { periodId } = req.params;
    const result = await service.updateSubmissionPeriod(periodId, req.body);

    return res.status(result.status).json(result);
  }

  async getSubmissionPeriods(req: Request, res: Response) {
    const { semesterId } = req.params;
    const result = await service.getSubmissionPeriods(semesterId);

    return res.status(result.status).json(result);
  }

  async getSubmissionPeriodById(req: Request, res: Response) {
    const { periodId } = req.params;
    const result = await service.getSubmissionPeriodById(periodId);

    return res.status(result.status).json(result);
  }

  async deleteSubmissionPeriod(req: Request, res: Response) {
    try {
      const { periodId } = req.params;
      const userId = req.user?.userId || ""; // Lấy userId từ thông tin đăng nhập
      const ipAddress = req.ip; // Lấy địa chỉ IP từ request

      if (!userId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Không tìm thấy thông tin người dùng.',
        });
      }

      if (!periodId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Thiếu ID đợt đề xuất!',
        });
      }

      const result = await service.deleteSubmissionPeriod(periodId, userId, ipAddress);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi khi đánh dấu xóa đợt đề xuất:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi đánh dấu xóa đợt đề xuất!',
      });
    }
  }
}
