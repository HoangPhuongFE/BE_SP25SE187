import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../utils/email";

const prisma = new PrismaClient();

export class EmailTemplateService {
  // 1. Kiểm tra người dùng
  async checkUserExists(userId: string) {
    if (!userId) throw new Error("User ID không hợp lệ.");
    return prisma.user.findUnique({ where: { id: userId } });
  }

  // 2. Lấy danh sách template
  async getAllTemplates() {
    return prisma.emailTemplate.findMany({ where: { isDeleted: false } });
  }

  // 3. Lấy template theo ID
  async getTemplateById(id: string) {
    const template = await prisma.emailTemplate.findUnique({ where: { id } });
  
    if (!template || template.isDeleted) {
      const error = new Error("Không tìm thấy mẫu email.");
      (error as any).statusCode = 404; // custom status code
      throw error;
    }
  
    return template;
  }
  
  // 4. Tạo template
  async createTemplate(data: {
    name: string;
    subject: string;
    body: string;
    description?: string;
    createdBy: string;
  }) {
    const existed = await prisma.emailTemplate.findUnique({ where: { name: data.name } });
    if (existed) throw new Error("Tên template đã tồn tại.");

    return prisma.emailTemplate.create({ data });
  }

  // 5. Cập nhật
  async updateTemplate(id: string, data: Partial<{ name: string; subject: string; body: string; description: string }>) {
    return prisma.emailTemplate.update({ where: { id }, data });
  }

  // 6. Xóa mềm
  async deleteTemplate(id: string) {
    return prisma.emailTemplate.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  // 7. Lấy danh sách biến trong template
  async getTemplateParams(id: string): Promise<string[]> {
    const template = await this.getTemplateById(id);
    const matches = template.body.match(/{{(.*?)}}/g);
    return matches ? matches.map((m) => m.replace(/{{|}}/g, "").trim()) : [];
  }

 
}
