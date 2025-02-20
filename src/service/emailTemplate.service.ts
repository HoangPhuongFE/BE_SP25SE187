import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class EmailTemplateService {
  async checkUserExists(userId: string) {
    if (!userId) throw new Error("User ID không hợp lệ.");
    return prisma.user.findUnique({ where: { id: userId } });
  }

  async getAllTemplates() {
    return prisma.emailTemplate.findMany();
  }

  async getTemplateById(id: string) {
    return prisma.emailTemplate.findUnique({ where: { id } });
  }

  async createTemplate(data: { name: string; subject: string; body: string; description?: string; createdBy: string }) {
    return prisma.emailTemplate.create({ data });
  }

  async updateTemplate(id: string, data: { name?: string; subject?: string; body?: string; description?: string }) {
    return prisma.emailTemplate.update({ where: { id }, data });
  }

  async deleteTemplate(id: string) {
    return prisma.emailTemplate.delete({ where: { id } });
  }
}
