import { Request, Response } from 'express';
import { ImportBlock3Service } from '../service/importBlock3.service';

export class ImportBlock3Controller {
  private importBlock3Service = new ImportBlock3Service();

  async importBlock3Handler(req: Request, res: Response) {
    const filePath = req.file?.path;
    const { semesterId } = req.body;
    const userId = req.user?.userId;

    if (!filePath || !semesterId || !userId) {
      return res.status(400).json({
        message: 'Thiếu thông tin bắt buộc: file, semesterId hoặc userId.',
      });
    }

    try {
      const importResult = await this.importBlock3Service.importBlock3Excel(
        filePath,
        semesterId,
        userId
      );

      if (importResult.status === 'error') {
        return res.status(400).json(importResult);
      }

      return res.status(200).json({
        message: 'Nhập dữ liệu thành công.',
        totalRecords: importResult.totalRecords,
        successRecords: importResult.successRecords,
        errorRecords: importResult.errorRecords,
        errors: importResult.errors,
      });
    } catch (error) {
      console.error('Import failed:', error);
      return res.status(500).json({ message: 'Lỗi hệ thống khi nhập dữ liệu.' });
    }
  }
}
