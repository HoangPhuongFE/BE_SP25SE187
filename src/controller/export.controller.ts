import { Request, Response } from "express";
import { exportStudentListService, exportConditionListService } from "../service/export.service";
import { EXPORT_MESSAGE, GENERAL_MESSAGE } from "../constants/message";

export const exportStudentList = async (req: Request, res: Response) => {
  try {
const { semesterId } = req.params;

const filePath = await exportStudentListService(semesterId);

    if (!filePath) {
      return res.status(404).json({ message: EXPORT_MESSAGE.NO_DATA_FOUND });
    }

    res.download(filePath, "Student_List.xlsx", (err) => {
      if (err) {
        console.error("Error while downloading student list:", err);
        res.status(500).json({ message: EXPORT_MESSAGE.EXPORT_FAILED });
      }
    });
  } catch (error) {
    console.error("Error exporting student list:", error);
    res.status(500).json({ message: GENERAL_MESSAGE.SERVER_ERROR });
  }
};

export const exportConditionList = async (req: Request, res: Response) => {
  try {
    const { semesterId } = req.params;
    const filePath = await exportConditionListService(semesterId);
    

    if (!filePath) {
      return res.status(404).json({ message: EXPORT_MESSAGE.NO_DATA_FOUND });
    }

    res.download(filePath, "Condition_List.xlsx", (err) => {
      if (err) {
        console.error("Error while downloading condition list:", err);
        res.status(500).json({ message: EXPORT_MESSAGE.EXPORT_FAILED });
      }
    });
  } catch (error) {
    console.error("Error exporting condition list:", error);
    res.status(500).json({ message: GENERAL_MESSAGE.SERVER_ERROR });
  }
};
