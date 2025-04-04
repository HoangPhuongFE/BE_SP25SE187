import { Request, Response } from 'express';
import { BusinessTopicService } from '../service/businessTopicService';
import HTTP_STATUS from '../constants/httpStatus';
import { MESSAGES } from '../constants/message';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; roles: any[] };
}

export class BusinessTopicController {
  private businessTopicService: BusinessTopicService;

  constructor() {
    this.businessTopicService = new BusinessTopicService();
  }

  async importBusinessTopics(req: AuthenticatedRequest, res: Response) {
    try {
      // Lấy businessId từ req.user (được thêm bởi middleware checkRole)
      const businessId = req.user?.userId;
      if (!businessId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          status: HTTP_STATUS.UNAUTHORIZED,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }

      // Lấy file từ request
      const file = req.file as Express.Multer.File;
      if (!file || !file.path) {
        console.log('No file uploaded or invalid file path:', req.file);
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: 'Không có file được upload hoặc file không hợp lệ.',
        });
      }

      // Lấy semesterId và submissionPeriodId từ query parameters
      const { semesterId, submissionPeriodId } = req.query;
      if (!semesterId || !submissionPeriodId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: !semesterId ? MESSAGES.TOPIC.SEMESTER_REQUIRED : MESSAGES.TOPIC_SUBMISSION_PERIOD.NOT_FOUND,
        });
      }

      // Lấy ipAddress từ request
      const ipAddress = req.ip || 'unknown';

      // Gọi service để xử lý nhập đề tài
      const result = await this.businessTopicService.importBusinessTopics(
        file,
        semesterId as string,
        submissionPeriodId as string,
        businessId,
        ipAddress
      );

      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong controller khi nhập đề tài:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: MESSAGES.GENERAL.SERVER_ERROR,
      });
    }
  }
}