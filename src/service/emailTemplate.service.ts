import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class EmailTemplateService {
  //  1. Kiểm tra xem user có tồn tại không
  async checkUserExists(userId: string) {
    if (!userId) throw new Error("User ID không hợp lệ.");
    return prisma.user.findUnique({ where: { id: userId } });
  }

  //  2. Lấy tất cả các template
  async getAllTemplates() {
    return prisma.emailTemplate.findMany();
  }

  //  3. Lấy template theo ID
  async getTemplateById(id: string) {
    return prisma.emailTemplate.findUnique({ where: { id } });
  }

  //  4. Tạo template mới
  async createTemplate(data: { name: string; subject: string; body: string; description?: string; createdBy: string }) {
    return prisma.emailTemplate.create({ data });
  }

  //  5. Cập nhật template
  async updateTemplate(id: string, data: { name?: string; subject?: string; body?: string; description?: string }) {
    return prisma.emailTemplate.update({ where: { id }, data });
  }

  //  6. Xóa template
  async deleteTemplate(id: string) {
    return prisma.emailTemplate.delete({ where: { id } });
  }

  //  7. Lấy danh sách tham số động trong nội dung template
  async getTemplateParams(id: string) {
    const template = await prisma.emailTemplate.findUnique({ where: { id } });

    if (!template) {
      throw new Error("Không tìm thấy template.");
    }

    // Tìm tất cả các biến dạng {{param}} trong nội dung email
    const matches = template.body.match(/{{(.*?)}}/g);
    return matches ? matches.map((m) => m.replace(/{{|}}/g, "")) : [];
  }
}
