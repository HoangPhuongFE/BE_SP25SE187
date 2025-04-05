import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/user.middleware';
import { DATA_MESSAGE } from '../constants/message';
import { ImportLecturerService } from '../services/importLecturer.service';

export class ImportLecturerController {
  private importLecturerService = new ImportLecturerService();

  async importLecturerHandler(req: AuthenticatedRequest, res: Response) {
    const filePath = req.file?.path;
    const { semesterId } = req.body;

    if (!filePath) return res.status(400).json({ message: DATA_MESSAGE.INVALID_FILE_FORMAT });
    if (!semesterId) return res.status(400).json({ message: DATA_MESSAGE.MISSING_SEMESTER });
    if (!req.user || !req.user.userId) return res.status(401).json({ message: DATA_MESSAGE.UNAUTHORIZED });

    try {
      const result = await this.importLecturerService.importExcel(filePath, req.user.userId, semesterId);
      return res.status(200).json({
        message: DATA_MESSAGE.IMPORT_SUCCESS,
        totalRecords: result.totalRecords,
        successRecords: result.successRecords,
        errorRecords: result.errorRecords,
        errors: result.errors,
      });
    } catch (error) {
      console.error('Import lecturer failed:', error);
      return res.status(500).json({ message: DATA_MESSAGE.IMPORT_FAILED, error: (error as Error).message });
    }
  }

  async getAllLecturersHandler(req: AuthenticatedRequest, res: Response) {
    const { semesterId } = req.query;

    if (!semesterId || typeof semesterId !== 'string') {
      return res.status(400).json({ message: 'Vui lòng cung cấp semesterId hợp lệ' });
    }
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: DATA_MESSAGE.UNAUTHORIZED });
    }

    try {
      const result = await this.importLecturerService.getAllLecturers(semesterId);
      return res.status(200).json({
        message: 'Lấy danh sách giảng viên thành công',
        data: result.data,
        total: result.total,
      });
    } catch (error) {
      console.error('Get lecturers failed:', error);
      return res.status(500).json({ message: 'Không thể lấy danh sách giảng viên', error: (error as Error).message });
    }
  }

  async getLecturerByIdHandler(req: AuthenticatedRequest, res: Response) {
    const { userId, semesterId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: 'Vui lòng cung cấp userId hợp lệ' });
    }
    if (!semesterId || typeof semesterId !== 'string') {
      return res.status(400).json({ message: 'Vui lòng cung cấp semesterId hợp lệ' });
    }
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: DATA_MESSAGE.UNAUTHORIZED });
    }

    try {
      const result = await this.importLecturerService.getLecturerById(userId, semesterId);
      return res.status(200).json({ message: 'Lấy thông tin giảng viên thành công', data: result.data });
    } catch (error) {
      console.error('Get lecturer by ID failed:', error);
      return res.status(500).json({ message: 'Không thể lấy thông tin giảng viên', error: (error as Error).message });
    }
  }
}