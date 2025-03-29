import { Request, Response } from "express";
import { SubmissionPeriodService } from "../service/submissionPeriod.service";
import HTTP_STATUS from "../constants/httpStatus";

const service = new SubmissionPeriodService();

export class SubmissionPeriodController {
  async createSubmissionPeriod(req: Request, res: Response) {
    const { semesterId, roundNumber, startDate, endDate, type, description } = req.body;
    const createdBy = req.user!.userId;

    // Kiểm tra xem type có được cung cấp không
    if (!["TOPIC", " CHECK-TOPIC" , "REVIEW", "DEFENSE"].includes(type)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Type phải là một trong các giá trị: TOPIC, REVIEW, DEFENSE",
      });
    }

    const result = await service.createSubmissionPeriod({
      semesterId,
      roundNumber,
      startDate,
      endDate,
      type, // Truyền type vào service
      description,
      createdBy,
    });

    return res.status(result.status).json(result);
  }

  async updateSubmissionPeriod(req: Request, res: Response) {
    const { periodId } = req.params;
    const { startDate, endDate, type, description } = req.body;

    // Kiểm tra type nếu có
    if (type && !["TOPIC", "REVIEW", "DEFENSE"].includes(type)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Type phải là một trong các giá trị: TOPIC, REVIEW, DEFENSE",
      });
    }

    const result = await service.updateSubmissionPeriod(periodId, {
      startDate,
      endDate,
      type, // Truyền type vào service nếu có
      description,
    });

    return res.status(result.status).json(result);
  }

  async getSubmissionPeriods(req: Request, res: Response) {
    const { semesterId } = req.params;
    const { type } = req.query; // Lấy type từ query parameters
    const result = await service.getSubmissionPeriods(
      semesterId,
      type as "TOPIC" | "CHECK-TOPIC" | "REVIEW" | "DEFENSE"
    );
    return res.status(result.status).json(result);
  }

  async getSubmissionPeriodById(req: Request, res: Response) {
    const { periodId } = req.params;
    const { type } = req.query; // Lấy expectedType từ query parameters
    const result = await service.getSubmissionPeriodById(
      periodId,
      type as "TOPIC" | "CHECK-TOPIC" | "REVIEW" | "DEFENSE"
    );
    return res.status(result.status).json(result);
  }

  async deleteSubmissionPeriod(req: Request, res: Response) {
    try {
      const { periodId } = req.params;
      const userId = req.user?.userId || "";
      const ipAddress = req.ip;

      if (!userId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: "Không tìm thấy thông tin người dùng.",
        });
      }

      if (!periodId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Thiếu ID đợt đề xuất!",
        });
      }

      const result = await service.deleteSubmissionPeriod(periodId, userId, ipAddress);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi khi đánh dấu xóa đợt đề xuất:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi hệ thống khi đánh dấu xóa đợt đề xuất!",
      });
    }
  }
}