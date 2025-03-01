import * as xlsx from "xlsx";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import HTTP_STATUS from "../constants/httpStatus";
import { MESSAGES } from "../constants/message";

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = "a123456";

export class ImportService {
  async processRoleImport(filePath: string) {
    try {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data: unknown[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });

      if (!data || data.length < 2) {
        throw new Error(MESSAGES.IMPORT.IMPORT_INVALID_FILE_FORMAT);
      }

      const errors: string[] = [];
      const usersToCreate = [];

      const header = data[0];
      const lecturerCodeIndex = header.findIndex((h) => (h as string).toLowerCase().includes("msgv"));
      const emailIndex = header.findIndex((h) => (h as string).toLowerCase().includes("mail"));
      const roleIndex = header.findIndex((h) => (h as string).toLowerCase().includes("role"));

      if (lecturerCodeIndex === -1 || emailIndex === -1 || roleIndex === -1) {
        throw new Error(MESSAGES.IMPORT.IMPORT_MISSING_REQUIRED_FIELDS);
      }

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const lecturerCode = String(row[lecturerCodeIndex] || "").trim();
        const email = String(row[emailIndex] || "").trim().toLowerCase();
        const roleName = String(row[roleIndex] || "").trim();

        if (!lecturerCode || !email || !roleName) {
          errors.push(MESSAGES.IMPORT.IMPORT_ROW_ERROR(i + 1, "Thiếu MSGV, email hoặc vai trò."));
          continue;
        }

        usersToCreate.push({ lecturerCode, email, roleName });
      }

      if (errors.length > 0) {
        return {
          status: "error",
          message: MESSAGES.IMPORT.IMPORT_PARTIALLY_FAILED,
          errors,
          httpStatus: HTTP_STATUS.IMPORT_PARTIALLY_FAILED,
        };
      }

      return {
        status: "success",
        message: MESSAGES.IMPORT.IMPORT_SUCCESS,
        httpStatus: HTTP_STATUS.IMPORT_SUCCESS,
      };
    } catch (error) {
      console.error("Lỗi khi import:", error);
      return {
        status: "error",
        message: MESSAGES.IMPORT.IMPORT_FAILED,
        error: (error as Error).message,
        httpStatus: HTTP_STATUS.IMPORT_FAILED,
      };
    }
  }
}
