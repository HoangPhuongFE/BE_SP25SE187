import { Request, Response } from "express";
import { YearService } from "../service/year.service";
import { YEAR_MESSAGE, GENERAL_MESSAGE } from "../constants/message";

export class YearController {
  private yearService = new YearService();

  // Lấy danh sách Year (phân trang)
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
      return res.status(201).json({ message: YEAR_MESSAGE.YEAR_CREATED, data: createdYear });
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

      // ID check logic
      if (!id || isNaN(Number(id))) {
        return res.status(400).json({ message: "Invalid ID parameter." });
      }
      if (!year || typeof year !== "number") {
        return res.status(400).json({ message: "Year is required and must be a number." });
      }

      const updatedYear = await this.yearService.updateYear(id, year);
      return res.status(200).json({ message: YEAR_MESSAGE.YEAR_UPDATED, data: updatedYear });
    } catch (error) {
      console.error("Error updating year:", error);
      return res.status(500).json({ message: GENERAL_MESSAGE.SERVER_ERROR });
    }
  }

  // Xoá Year
  async deleteYear(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const year = await this.yearService.deleteYear(id);
      return res.status(200).json({ message: YEAR_MESSAGE.YEAR_DELETED, data: year });
    } catch (error) {
      console.error("Error deleting year:", error);
      return res.status(500).json({ message: GENERAL_MESSAGE.SERVER_ERROR });
    }
  }
}
