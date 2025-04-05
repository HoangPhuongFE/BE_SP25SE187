import { Request, Response } from "express";
import { YearService } from "../services/year.service";
import { YEAR_MESSAGE, GENERAL_MESSAGE } from "../constants/message";

export class YearController {
  private yearService = new YearService();

  // Lấy danh sách Year
  async getAllYears(req: Request, res: Response) {
    try {
      const { page = 1, pageSize = 10 } = req.query;
      const result = await this.yearService.getAllYears(Number(page), Number(pageSize));

      return res.status(200).json({
        message: YEAR_MESSAGE.YEAR_FETCHED,
        data: result,
      });
    } catch (error) {
      console.error("Error fetching years:", error);
      return res.status(500).json({ message: GENERAL_MESSAGE.SERVER_ERROR });
    }
  }

  // Tạo mới Year
  async createYear(req: Request, res: Response) {
    try {
      const { year } = req.body;
      if (!year || typeof year !== "number") {
        return res.status(400).json({ message: "Year is required and must be a number." });
      }

      const createdYear = await this.yearService.createYear(year);
      return res.status(201).json({
        message: YEAR_MESSAGE.YEAR_CREATED,
        data: createdYear
      });
    } catch (error) {
      console.error("Error creating year:", error);
      return res.status(500).json({ message: GENERAL_MESSAGE.SERVER_ERROR });
    }
  }

  // Cập nhật Year
  async updateYear(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { year } = req.body;

      const updatedYear = await this.yearService.updateYear(id, year);
      return res.status(200).json({
        message: YEAR_MESSAGE.YEAR_UPDATED,
        data: updatedYear
      });
    } catch (error) {
      console.error("Error updating year:", error);
      if ((error as any).code === 'P2025') {
        return res.status(404).json({ message: YEAR_MESSAGE.YEAR_NOT_FOUND });
      }
      return res.status(500).json({ message: GENERAL_MESSAGE.SERVER_ERROR });
    }
  }

  // Xoá (soft delete) Year
  async deleteYear(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId || "";
      const ipAddress = req.ip;

      if (!userId) {
        return res.status(401).json({ message: "Thiếu thông tin người dùng." });
      }

      const result = await this.yearService.deleteYear(id, userId, ipAddress);

      return res.status(200).json({
        message: "Năm học đã được đánh dấu xóa.",
        data: result,
      });
    } catch (error) {
      console.error("Error marking year as deleted:", error);
      if ((error as Error).message === "YEAR_NOT_FOUND") {
        return res.status(404).json({ message: "Không tìm thấy năm học." });
      }
      return res.status(500).json({
        message: "Có lỗi xảy ra trên server.",
        error: "Đã có lỗi khi xóa mềm năm học và dữ liệu liên quan",
      });
    }
  }
}
