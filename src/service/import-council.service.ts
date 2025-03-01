import { PrismaClient } from "@prisma/client";
import HTTP_STATUS from "../constants/httpStatus";

const prisma = new PrismaClient();

export class ImportCouncilService {
    async processExcelFile(worksheet: any, semesterId: string) {
        try {
            let errors: any[] = [];
            let councilsData: any[] = [];
            let councilMembersData: any[] = [];

            worksheet.eachRow((row: any, rowNumber: number) => {
                if (rowNumber === 1) return;

                const memberEmail = row.getCell(1).text.trim();
                const councilCode = row.getCell(2).text.trim();
                const councilName = row.getCell(3).text.trim();
                const type = row.getCell(4).text.trim();
                const round = parseInt(row.getCell(5).text.trim());
                const memberRole = row.getCell(6).text.trim().toLowerCase();

                if (!memberEmail || !councilCode || !councilName || !type || !round || !memberRole) {
                    errors.push({
                        row: rowNumber,
                        error: "Thiếu dữ liệu bắt buộc.",
                        details: { memberEmail, councilCode, councilName, type, round, memberRole },
                    });
                    return;
                }

                const validRoles = ["chairman", "secretary", "reviewer"];
                if (!validRoles.includes(memberRole)) {
                    errors.push({ row: rowNumber, error: `Vai trò không hợp lệ: ${memberRole}` });
                    return;
                }

                councilsData.push({ councilCode, councilName, type, round, semesterId });
                councilMembersData.push({ memberEmail, councilCode, memberRole });
            });

            if (errors.length > 0) {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: "Có lỗi trong file import. Vui lòng sửa lỗi và thử lại.",
                    errors,
                };
            }

            const importResult = await this.saveToDatabase(councilsData, councilMembersData, semesterId);

            return {
                success: true,
                status: HTTP_STATUS.CREATED,
                message: "Import danh sách hội đồng thành công.",
                data: importResult,
            };
        } catch (error) {
            console.error(" Lỗi khi xử lý file Excel:", error);
            return {
                success: false,
                status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
                message: "Đã xảy ra lỗi khi xử lý file import.",
            };
        }
    }

    async saveToDatabase(councilsData: any[], councilMembersData: any[], semesterId: string) {
        try {
            // 1️⃣ Tạo danh sách hội đồng
            await prisma.council.createMany({
                data: councilsData.map(c => ({
                    code: c.councilCode,
                    name: c.councilName,
                    type: c.type.toUpperCase(),
                    round: c.round,
                    semesterId: c.semesterId,
                    status: "ACTIVE",
                })),
                skipDuplicates: true,
            });

            // 2️⃣ Lấy danh sách hội đồng vừa tạo
            const councils = await prisma.council.findMany({
                where: { code: { in: councilsData.map(c => c.councilCode) } },
                select: { id: true, code: true },
            });
            const councilMap = new Map(councils.map(c => [c.code, c.id]));

            // 3️⃣ Lấy danh sách userId từ email
            const users = await prisma.user.findMany({
                where: { email: { in: councilMembersData.map(m => m.memberEmail) } },
                select: { id: true, email: true },
            });
            const userMap = new Map(users.map(u => [u.email, u.id]));

            // 4️⃣ Chuẩn bị danh sách thành viên hội đồng (lọc bỏ những bản ghi không hợp lệ)
            const membersToInsert = councilMembersData
                .map(m => {
                    const councilId = councilMap.get(m.councilCode);
                    const userId = userMap.get(m.memberEmail);
                    if (!councilId || !userId) {
                        console.warn(`⚠️ Bỏ qua thành viên hội đồng do thiếu thông tin:`, m);
                        return null;
                    }
                    return {
                        councilId,
                        userId,
                        role: m.memberRole,
                        status: "ACTIVE",
                        semesterId: semesterId,
                    };
                })
                .filter(m => m !== null);

            console.log(" Thành viên hợp lệ trước khi insert:", membersToInsert);

            // 5️⃣ Insert danh sách thành viên hội đồng
            try {
                await prisma.councilMember.createMany({
                    data: membersToInsert,
                    skipDuplicates: true,
                });
                console.log(" Thành viên hội đồng đã được thêm thành công.");
            } catch (error) {
                console.error(" Lỗi khi thêm thành viên hội đồng:", error);
            }

            return { councilsAdded: councilsData.length, membersAdded: membersToInsert.length };
        } catch (error) {
            throw new Error(" Lỗi khi import danh sách hội đồng.");
        }
    }
}
