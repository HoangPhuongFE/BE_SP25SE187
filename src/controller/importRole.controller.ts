import { Request, Response } from "express";
import { ImportService } from "../service/importRole.service";

const importService = new ImportService();

export class ImportRoleController {
  async importRoles(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Không có file nào được tải lên." });
      }

      const result = await importService.processRoleImport(req.file.path);

      return res.status(200).json({
        message: "Import thành công!",
        data: result,
      });
    } catch (error) {
      console.error("Lỗi khi import role:", error);
      return res.status(500).json({ message: "Lỗi khi nhập vai trò.", error: (error as Error).message });
    }
  }
}
