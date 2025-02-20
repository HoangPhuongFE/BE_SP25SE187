import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class EmailTemplateController {
  async getAllTemplates(req: Request, res: Response) {
    try {
      const templates = await prisma.emailTemplate.findMany();
      return res.status(200).json(templates);
    } catch (error) {
      return res.status(500).json({ message: "Lỗi khi lấy danh sách template." });
    }
  }

  async getTemplateParams(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const template = await prisma.emailTemplate.findUnique({ where: { id } });

      if (!template) {
        return res.status(404).json({ message: "Không tìm thấy template." });
      }

      // Tự động tìm các biến {{param}} trong nội dung email
      const matches = template.body.match(/{{(.*?)}}/g);
      const params = matches ? matches.map((m) => m.replace(/{{|}}/g, "")) : [];

      return res.status(200).json({ params });
    } catch (error) {
      return res.status(500).json({ message: "Lỗi khi lấy tham số template." });
    }
  }
}
