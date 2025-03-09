import { Request, Response } from 'express';
import HTTP_STATUS from '../constants/httpStatus';
import { ImportTopicService } from '../service/import-topic.service';
import fs from 'fs';

const importTopicService = new ImportTopicService();

export class ImportTopicController {
  async importTopics(req: Request, res: Response) {
    let filePath: string | undefined;
    try {
      // Kiểm tra đăng nhập
      if (!req.user || !req.user.userId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: 'Unauthorized: Bạn cần đăng nhập để thực hiện hành động này!',
        });
      }

      // Kiểm tra quyền (giả sử roles là mảng tên vai trò)
      const allowedRoles = ['admin', 'graduation_thesis_manager'];
      const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [];
      const hasPermission = userRoles.some((role: string) => allowedRoles.includes(role));
      if (!hasPermission) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: 'Forbidden: Bạn không có quyền import dữ liệu!',
        });
      }

      // Kiểm tra file upload
      if (!req.file) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Không tìm thấy file upload!',
        });
      }

      // Kiểm tra định dạng file
      if (req.file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'File không hợp lệ! Chỉ chấp nhận file Excel (.xlsx)',
        });
      }

      // Import dữ liệu
      filePath = req.file.path;
      const createdBy = req.user.userId;
      const result = await importTopicService.importTopicsFromExcel(filePath, createdBy);

      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi khi import đề tài:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi import đề tài!',
      });
    } finally {
      // Xóa file tạm
      if (filePath) {
        fs.unlink(filePath, (err) => {
          if (err) console.error('Lỗi khi xóa file tạm:', err);
        });
      }
    }
  }
}