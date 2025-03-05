// controllers/import-topic.controller.ts
import { Request, Response } from 'express';
import HTTP_STATUS from '../constants/httpStatus';
import { ImportTopicService } from '../service/import-topic.service';

const importTopicService = new ImportTopicService();

export class ImportTopicController {
  async importTopics(req: Request, res: Response) {
    try {
      // Kiểm tra file được upload (sử dụng multer)
      if (!req.file) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Không tìm thấy file upload!' });
      }

      // Giả sử bạn lấy thông tin người dùng từ req.user
      const createdBy = req.user?.userId || 'import-user';
      const filePath = req.file.path; 
      const result = await importTopicService.importTopicsFromExcel(filePath, createdBy);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi khi import đề tài:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi import đề tài!',
      });
    }
  }
}
