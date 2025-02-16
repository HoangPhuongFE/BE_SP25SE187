import { Request, Response } from "express";
import { SEMESTER_MESSAGE, GENERAL_MESSAGE } from "../constants/message";
import { SemesterService } from "../service/semester.service";

export class SemesterController {
  private semesterService = new SemesterService();

  // Lấy danh sách semester theo yearId, có phân trang
  async getSemestersByYear(req: Request, res: Response) {
    try {
      const { page = 1, pageSize = 10 } = req.query;
      const { yearId } = req.params;

      if (!yearId) {
        return res.status(400).json({
          message: SEMESTER_MESSAGE.INVALID_SEMESTER_ID,
        });
      }

      const result = await this.semesterService.getSemestersByYear(
        yearId,
        Number(page),
        Number(pageSize),
      );

      return res.status(200).json({
        message: SEMESTER_MESSAGE.SEMESTERS_FETCHED,
        data: result,
      });
    } catch (error) {
      console.error("Error fetching semesters:", error);
      return res.status(500).json({ 
        message: GENERAL_MESSAGE.SERVER_ERROR 
      });
    }
  }

  // Tạo mới semester
  async createSemester(req: Request, res: Response) {
    try {
      const { yearId, code, startDate, endDate, status } = req.body;

      const semester = await this.semesterService.createSemester(
        yearId,
        code,
        new Date(startDate),
        new Date(endDate),
        status,
      );

      return res.status(201).json({
        message: SEMESTER_MESSAGE.SEMESTER_CREATED,
        data: semester,
      });
    } catch (error) {
      console.error("Error creating semester:", error);
      return res.status(500).json({
        message: GENERAL_MESSAGE.SERVER_ERROR,
      });
    }
  }

  // Cập nhật semester
  async updateSemester(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { code, startDate, endDate, status } = req.body; 
      // Bỏ hẳn registrationDeadline vì bảng không có

      const semester = await this.semesterService.updateSemester(
        id,
        code,
        new Date(startDate),
        new Date(endDate),
        status,
      );

      return res.status(200).json({
        message: SEMESTER_MESSAGE.SEMESTER_UPDATED,
        data: semester,
      });
    } catch (error) {
      console.error("Error updating semester:", error);
      return res.status(500).json({
        message: GENERAL_MESSAGE.SERVER_ERROR,
      });
    }
  }

  // Xóa semester
  async deleteSemester(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const semester = await this.semesterService.deleteSemester(id);

      return res.status(200).json({
        message: SEMESTER_MESSAGE.SEMESTER_DELETED,
        data: semester,
      });
    } catch (error) {
      console.error("Error deleting semester:", error);
      return res.status(500).json({
        message: GENERAL_MESSAGE.SERVER_ERROR,
      });
    }
  }

  // Lấy tất cả semester (không phân trang)
  async getAllSemesters(req: Request, res: Response) {
    try {
      const semesters = await this.semesterService.getAllSemesters();
      return res.status(200).json({
        message: SEMESTER_MESSAGE.SEMESTERS_FETCHED,
        data: semesters,
      });
    } catch (error) {
      console.error("Error fetching all semesters:", error);
      return res.status(500).json({
        message: GENERAL_MESSAGE.SERVER_ERROR,
      });
    }
  }

  // Lấy 1 semester theo id
  async getSemesterById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          message: SEMESTER_MESSAGE.INVALID_SEMESTER_ID,
        });
      }

      const semester = await this.semesterService.getSemesterById(id);

      return res.status(200).json({
        message: SEMESTER_MESSAGE.SEMESTER_FETCHED,
        data: semester,
      });
    } catch (error) {
      console.error("Error fetching semester by ID:", error);

      // Xử lý lỗi SEMESTER_NOT_FOUND
      if (
        error instanceof Error &&
        error.message === SEMESTER_MESSAGE.SEMESTER_NOT_FOUND
      ) {
        return res.status(404).json({
          message: SEMESTER_MESSAGE.SEMESTER_NOT_FOUND,
        });
      }

      // Lỗi còn lại
      return res.status(500).json({
        message: GENERAL_MESSAGE.SERVER_ERROR,
      });
    }
  }
}
