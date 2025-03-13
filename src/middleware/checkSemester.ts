import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


export async function checkSemester(req: Request, res: Response, next: NextFunction) {
    try {
        // Lấy groupId từ req.params và semesterId từ req.query
        const groupId = req.params.groupId;
        const semesterId = req.params.semesterId as string; // Ép kiểu nếu cần
        const groupCode = req.body.groupCode; // Giữ lại cho các phương thức khác như POST

        // Kiểm tra nếu thiếu tất cả các tham số cần thiết
        if (!groupId && !semesterId && !groupCode) {
            return res.status(400).json({ message: "Cần cung cấp semesterId, groupId hoặc groupCode." });
        }

        // Nếu có groupId, kiểm tra nhóm tồn tại
        if (groupId) {
            const group = await prisma.group.findUnique({
                where: { id: groupId },
                include: { semester: true },
            });
            if (!group) {
                return res.status(404).json({ message: "Nhóm không tồn tại." });
            }
        }

        // Nếu có semesterId, kiểm tra học kỳ tồn tại
        if (semesterId) {
            const semester = await prisma.semester.findUnique({
                where: { id: semesterId },
            });
            if (!semester) {
                return res.status(404).json({ message: "Học kỳ không tồn tại." });
            }
        }

        // Tiếp tục xử lý logic khác (nếu cần)
        next();
    } catch (error) {
        return res.status(500).json({ message: "Lỗi kiểm tra học kỳ.", error: (error as Error).message });
    }
}