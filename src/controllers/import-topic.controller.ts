import { Request, Response } from 'express';
import HTTP_STATUS from '../constants/httpStatus';
import { ImportTopicUpdateService } from '../services/import-topic.service';

const importTopicUpdateService = new ImportTopicUpdateService();

export class ImportTopicController {
  async importTopicUpdates(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Vui lòng upload file Excel!',
        });
      }
      
      // Giả sử bạn truyền userId và semesterId từ request (có thể lấy từ req.user hoặc params)
      const userId = req.user?.userId || 'default-user-id';
      const semesterId = req.query.semesterId as string || '';
      
      const result = await importTopicUpdateService.importTopicUpdatesFromExcel(req.file.path, userId, semesterId);
      // Nếu cần, xoá file tạm: fs.unlinkSync(req.file.path);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong controller importTopicUpdates:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi import cập nhật đề tài.',
      });
    }
  }
}
