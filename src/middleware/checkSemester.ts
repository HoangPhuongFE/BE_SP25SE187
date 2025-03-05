import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


export async function checkSemester(req: Request, res: Response, next: NextFunction) {
    try {
        const { groupId, groupCode } = req.body || req.params;

        // Nếu cả groupId và groupCode đều không có, trả về lỗi
        if (!groupId && !groupCode) {
            return res.status(400).json({ message: "Cần cung cấp groupId hoặc groupCode." });
        }

        // Tìm nhóm dựa trên groupId hoặc groupCode
        const group = await prisma.group.findFirst({
            where: {
                OR: [{ id: groupId }, { groupCode: groupCode }],
            },
            include: { semester: true },
        });

        if (!group) return res.status(404).json({ message: "Nhóm không tồn tại." });

        const now = new Date();
        const isInSemester = group.semester.startDate <= now && now <= group.semester.endDate;

        if (isInSemester) {
            const user = req.user;
            if (!user) return res.status(401).json({ message: "Không có thông tin người dùng." });

            const userRoles = await prisma.userRole.findMany({
                where: { userId: user.userId },
                include: { role: true },
            });

            const isAdmin = userRoles.some(r => ["admin", "academic_officer"].includes(r.role.name.toLowerCase()));

            if (!isAdmin) {
                return res.status(403).json({ message: "Chỉ Admin hoặc Academic Officer mới có quyền thao tác khi học kỳ đang diễn ra." });
            }
        }

        next();
    } catch (error) {
        return res.status(500).json({ message: "Lỗi kiểm tra học kỳ.", error: (error as Error).message });
    }
}
