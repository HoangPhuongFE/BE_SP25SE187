import * as xlsx from "xlsx";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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
        throw new Error("File Excel không hợp lệ hoặc không có dữ liệu.");
      }

      const errors: string[] = [];
      const usersToCreate = [];

      const header = data[0];
      const emailIndex = header.findIndex((h) => (h as string).toLowerCase().includes("mail"));
      const roleIndex = header.findIndex((h) => (h as string).toLowerCase().includes("role"));

      if (emailIndex === -1 || roleIndex === -1) {
        throw new Error("File Excel thiếu cột email hoặc role.");
      }

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const email = String(row[emailIndex] || "").trim().toLowerCase();
        const roleName = String(row[roleIndex] || "").trim();

        if (!email || !roleName) {
          errors.push(`Dòng ${i + 1}: Thiếu email hoặc vai trò.`);
          continue;
        }

        usersToCreate.push({ email, roleName });
      }

      if (usersToCreate.length === 0) {
        return { status: "error", message: "Không có dữ liệu hợp lệ để import.", errors };
      }

      // Kiểm tra user và role trong hệ thống
      const existingUsers = await prisma.user.findMany({
        where: { email: { in: usersToCreate.map((u) => u.email) } },
        select: { email: true, id: true },
      });

      const existingRoles = await prisma.role.findMany({
        where: { name: { in: usersToCreate.map((u) => u.roleName) } },
        select: { name: true, id: true },
      });

      const usersMap = new Map(existingUsers.map((u) => [u.email, u.id]));
      const rolesMap = new Map(existingRoles.map((r) => [r.name, r.id]));

      let successCount = 0;
      for (const { email, roleName } of usersToCreate) {
        let userId = usersMap.get(email);

        if (!userId) {
          const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
          const newUser = await prisma.user.create({
            data: {
              email,
              username: email.split("@")[0],
              passwordHash: hashedPassword,
              createdAt: new Date(),
            },
          });
          userId = newUser.id;
          usersMap.set(email, userId);
        }

        let roleId = rolesMap.get(roleName);
        if (!roleId) {
          const newRole = await prisma.role.create({
            data: { name: roleName, createdAt: new Date() },
          });
          roleId = newRole.id;
          rolesMap.set(roleName, roleId);
        }

        const existingUserRole = await prisma.userRole.findFirst({
          where: { userId, roleId },
        });

        if (!existingUserRole) {
          await prisma.userRole.create({
            data: { userId, roleId, assignedAt: new Date(), isActive: true },
          });
        }

        successCount++;
      }

      return {
        status: "success",
        message: `Import thành công! Đã thêm ${successCount} user.`,
        errors,
      };
    } catch (error) {
      console.error("Lỗi khi import:", error);
      return { status: "error", message: "Import thất bại", error: (error as Error).message };
    }
  }
}
