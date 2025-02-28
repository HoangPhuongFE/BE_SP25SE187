import { Request, Response } from "express";
import { ImportService } from "../service/importRole.service";
import HTTP_STATUS from "../constants/httpStatus";
import { MESSAGES } from "../constants/message";

const importService = new ImportService();

export class ImportRoleController {
  async importRoles(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          message: MESSAGES.IMPORT.IMPORT_MISSING_REQUIRED_FIELDS,
          error: "Không có file nào được tải lên.",
        });
      }

      const result = await importService.processRoleImport(req.file.path);

      if (result.status === "error") {
        return res.status(result.httpStatus).json({
          message: result.message,
          errors: result.errors || [],
          errorDetail: result.error || null,
        });
      }

      return res.status(HTTP_STATUS.OK).json({
        message: MESSAGES.IMPORT.IMPORT_SUCCESS,
        data: result,
      });

    } catch (error) {
      console.error("Lỗi khi import role:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: MESSAGES.IMPORT.IMPORT_FAILED,
        error: (error as Error).message,
      });
    }
  }
}
