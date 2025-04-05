import { Request, Response } from "express";
import { DATA_MESSAGE } from "../constants/message";
import { AuthenticatedRequest } from "~/middleware/user.middleware";
import { ImportStudentService } from "../services/importStudent.service";

export class ImportStudentController {
  private importStudentService = new ImportStudentService();

  async importStudentHandler(req: AuthenticatedRequest, res: Response) {
    const filePath = req.file?.path;
    const { semesterId } = req.body;

    if (!filePath) {
      return res.status(400).json({ message: DATA_MESSAGE.INVALID_FILE_FORMAT });
    }

    if (!semesterId) {
      return res.status(400).json({ message: DATA_MESSAGE.MISSING_SEMESTER });
    }

    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: "Unauthorized: Missing user information." });
    }

    try {
      const result = await this.importStudentService.importExcel(filePath, req.user.userId, semesterId);
      
      if (result.status === 'error') {
        return res.status(400).json({
          message: result.message,
          totalRecords: result.totalRecords || 0,
          successRecords: result.successRecords || 0,
          errorRecords: result.errorRecords || result.errors.length,
          errors: result.errors,
        });
      }

      return res.status(200).json({
        message: result.message,
        totalRecords: result.totalRecords,
        successRecords: result.successRecords,
        errorRecords: result.errorRecords,
        errors: result.errors,
      });
    } catch (error) {
      console.error("Import failed:", error);
      return res.status(500).json({ message: DATA_MESSAGE.IMPORT_FAILED, error: (error as Error).message });
    }
  }
}