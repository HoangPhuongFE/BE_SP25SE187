import { Request, Response } from 'express';
import HTTP_STATUS from '../constants/httpStatus';
import { ExportTopicService } from '../service/export-topic.service';

const exportTopicService = new ExportTopicService();

export class ExportTopicController {
  async exportTopicsForApproval(req: Request, res: Response) {
    try {
      const { submissionPeriodId, round, semesterId } = req.query;
      const query = {
        submissionPeriodId: submissionPeriodId as string | undefined,
        round: round ? Number(round) : undefined,
        semesterId: semesterId as string | undefined,
      };

      if (!query.submissionPeriodId && (query.round === undefined || !query.semesterId)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Thiếu submissionPeriodId hoặc round và semesterId!',
        });
      }

      const topicsResult = await exportTopicService.getTopicsForApproval(query);
      if (!topicsResult.success) {
        return res.status(topicsResult.status).json(topicsResult);
      }
      if (!topicsResult.data) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: 'Không có dữ liệu để xuất Excel!',
        });
      }

      const exportResult = await exportTopicService.exportTopicsToExcel(topicsResult.data);
      if (!exportResult.success) {
        return res.status(exportResult.status).json(exportResult);
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=topics-for-approval.xlsx');
      res.send(exportResult.data);
    } catch (error) {
      console.error('Lỗi khi xuất danh sách đề tài:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Lỗi hệ thống khi xuất danh sách đề tài!',
      });
    }
  }
}
