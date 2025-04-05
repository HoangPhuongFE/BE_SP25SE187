import { Request, Response } from "express";
import { EXPORT_MESSAGE, GENERAL_MESSAGE } from "../constants/message";
import { ExportService } from "../services/export.conditions.students.service";

export class ExportController {
  private exportService = new ExportService();

  // Method 1
  async exportStudentList(req: Request, res: Response) {
    try {
      const { semesterId } = req.params;
      const filePath = await this.exportService.exportStudentList(semesterId);

      // Controller check success
      // filePath trả về là đường dẫn file => ta download
      res.download(filePath, "Student_List.xlsx", (err) => {
        if (err) {
          console.error("Error while downloading student list:", err);
          res.status(500).json({ message: EXPORT_MESSAGE.EXPORT_FAILED });
        }
      });
    } catch (error) {
      if ((error as Error).message === EXPORT_MESSAGE.NO_DATA_FOUND) {
        return res.status(404).json({ message: EXPORT_MESSAGE.NO_DATA_FOUND });
      }
      console.error("Error exporting student list:", error);
      res.status(500).json({ message: GENERAL_MESSAGE.SERVER_ERROR });
    }
  }

  // Method 2
  async exportConditionList(req: Request, res: Response) {
    try {
      const { semesterId } = req.params;
      const filePath = await this.exportService.exportConditionList(semesterId);

      res.download(filePath, "Condition_List.xlsx", (err) => {
        if (err) {
          console.error("Error while downloading condition list:", err);
          res.status(500).json({ message: EXPORT_MESSAGE.EXPORT_FAILED });
        }
      });
    } catch (error) {
      if ((error as Error).message === EXPORT_MESSAGE.NO_DATA_FOUND) {
        return res.status(404).json({ message: EXPORT_MESSAGE.NO_DATA_FOUND });
      }
      console.error("Error exporting condition list:", error);
      res.status(500).json({ message: GENERAL_MESSAGE.SERVER_ERROR });
    }
  }
}
