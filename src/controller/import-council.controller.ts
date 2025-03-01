import { Request, Response } from "express";
import ExcelJS from "exceljs";
import fs from "fs";
import { ImportCouncilService } from "../service/import-council.service";
import HTTP_STATUS from "../constants/httpStatus";

const importCouncilService = new ImportCouncilService();

export class ImportCouncilController {
    async importCouncils(req: Request, res: Response) {
        try {
            if (!req.file) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    message: "Vui lòng tải lên file Excel hợp lệ.",
                });
            }

            const { semesterId } = req.body;

            if (!semesterId) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    message: "Thiếu semesterId, vui lòng chọn học kỳ trước khi import.",
                });
            }

            const filePath = req.file.path;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);
            const worksheet = workbook.getWorksheet(1);

            if (!worksheet) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    message: "File Excel không có dữ liệu.",
                });
            }

            const result = await importCouncilService.processExcelFile(worksheet, semesterId);

            fs.unlinkSync(filePath); // Xóa file sau khi xử lý

            return res.status(result.status).json(result);

        } catch (error) {
            console.error(" Lỗi khi import hội đồng:", error);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: "Đã xảy ra lỗi khi xử lý file import.",
            });
        }
    }
}
