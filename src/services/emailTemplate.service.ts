import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../utils/email.js";

const prisma = new PrismaClient();

export class EmailTemplateService {
  async checkUserExists(userId: string) {
    if (!userId) throw new Error("User ID không hợp lệ.");
    return prisma.user.findUnique({ where: { id: userId } });
  }

  async getAllTemplates() {
    return prisma.emailTemplate.findMany({ where: { isDeleted: false } });
  }

  async getTemplateById(id: string) {
    const template = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!template || template.isDeleted) {
      const error = new Error("Không tìm thấy mẫu email.") as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }
    return template;
  }

  async getTemplateByName(name: string) {
    const template = await prisma.emailTemplate.findFirst({
      where: { name, isDeleted: false },
    });
    if (!template) {
      const error = new Error("Không tìm thấy mẫu email.") as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }
    return template;
  }

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

  async updateTemplate(id: string, data: Partial<{ name: string; subject: string; body: string; description: string }>) {
    return prisma.emailTemplate.update({ where: { id }, data });
  }

  async deleteTemplate(id: string) {
    return prisma.emailTemplate.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  async getTemplateParams(id: string): Promise<string[]> {
    const template = await this.getTemplateById(id);
    const matches = template.body.match(/{{(.*?)}}/g);
    return matches ? matches.map((m) => m.replace(/{{|}}/g, "").trim()) : [];
  }
}

export default EmailTemplateService;