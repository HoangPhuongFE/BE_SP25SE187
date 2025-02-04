import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/user.middleware';
import { DATA_MESSAGE } from '../constants/message';
import { ImportConditionService } from '../service/importCondition.service';

export class ImportConditionController {
  
  private importConditionService = new ImportConditionService();

 
  async importConditionListHandler(req: AuthenticatedRequest, res: Response) {
    const filePath = req.file?.path;
    const fileName = req.file?.originalname;
    const { semesterId } = req.body;

    if (!filePath || !semesterId) {
      return res.status(400).json({
        message: DATA_MESSAGE.MISSING_REQUIRED_FIELDS,
        details: 'File path and semesterId are required',
      });
    }

    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: DATA_MESSAGE.UNAUTHORIZED });
    }

    try {
  
      const importResult = await this.importConditionService.importConditionExcel(
        filePath,
        semesterId,
        req.user.userId
      );

      return res.status(200).json({
        message: DATA_MESSAGE.IMPORT_SUCCESS,
        fileName: fileName || 'unknown',
        totalRecords: importResult.totalRecords,
        successRecords: importResult.successRecords,
        errorRecords: importResult.errorRecords,
        errors: importResult.errors,
      });
    } catch (error) {
      console.error('Import failed:', error);
      return res.status(500).json({ message: DATA_MESSAGE.IMPORT_FAILED });
    }
  }
}
