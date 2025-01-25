import { Request, Response } from "express";
import { importExcel } from "../service/importStudent.service";
import { DATA_MESSAGE } from "../constants/message";
import { AuthenticatedRequest } from "~/middleware/user.middleware";

export async function importStudentHandler(req: AuthenticatedRequest, res: Response) {
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
    await importExcel(filePath, req.user.userId, Number(semesterId));
    return res.status(200).json({ message: DATA_MESSAGE.IMPORT_SUCCESS });
  } catch (error) {
    console.error("Import failed:", error);
    return res.status(500).json({ message: DATA_MESSAGE.IMPORT_FAILED });
  }
}
