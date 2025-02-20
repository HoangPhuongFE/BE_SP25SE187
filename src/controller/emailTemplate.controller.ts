import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class EmailTemplateController {
  //  1. Lấy tất cả các template email
  async getAllTemplates(req: Request, res: Response) {
    try {
      const templates = await prisma.emailTemplate.findMany();
      return res.status(200).json(templates);
    } catch (error) {
      console.error("Lỗi khi lấy danh sách template:", error);
      return res.status(500).json({ message: "Lỗi khi lấy danh sách template." });
    }
  }

  //  2. Lấy thông tin template theo ID
  async getTemplateById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const template = await prisma.emailTemplate.findUnique({ where: { id } });

      if (!template) {
        return res.status(404).json({ message: "Không tìm thấy template." });
      }

      return res.status(200).json(template);
    } catch (error) {
      console.error("Lỗi khi lấy template theo ID:", error);
      return res.status(500).json({ message: "Lỗi khi lấy template theo ID." });
    }
  }

  //  3. Lấy danh sách tham số động trong template
  async getTemplateParams(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const template = await prisma.emailTemplate.findUnique({ where: { id } });

      if (!template) {
        return res.status(404).json({ message: "Không tìm thấy template." });
      }

      // Tìm tất cả các biến {{param}} trong nội dung email
      const matches = template.body.match(/{{(.*?)}}/g);
      const params = matches ? matches.map((m) => m.replace(/{{|}}/g, "")) : [];

      return res.status(200).json({ params });
    } catch (error) {
      console.error("Lỗi khi lấy tham số template:", error);
      return res.status(500).json({ message: "Lỗi khi lấy tham số template." });
    }
  }

  //  4. Tạo template mới
  async createTemplate(req: Request, res: Response) {
    try {
      const { name, subject, body, description } = req.body;
      const createdBy = req.user?.userId;

      if (!createdBy) {
        return res.status(401).json({ message: "Không có quyền truy cập." });
      }

      const newTemplate = await prisma.emailTemplate.create({
        data: { name, subject, body, description, createdBy },
      });

      return res.status(201).json(newTemplate);
    } catch (error) {
      console.error("Lỗi khi tạo template:", error);
      return res.status(500).json({ message: "Lỗi khi tạo template." });
    }
  }

  //  5. Cập nhật template
  async updateTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, subject, body, description } = req.body;

      const updatedTemplate = await prisma.emailTemplate.update({
        where: { id },
        data: { name, subject, body, description },
      });

      return res.status(200).json(updatedTemplate);
    } catch (error) {
      console.error("Lỗi khi cập nhật template:", error);
      return res.status(500).json({ message: "Lỗi khi cập nhật template." });
    }
  }

  //  6. Xóa template
  async deleteTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await prisma.emailTemplate.delete({ where: { id } });

      return res.status(200).json({ message: "Template đã được xóa thành công." });
    } catch (error) {
      console.error("Lỗi khi xóa template:", error);
      return res.status(500).json({ message: "Lỗi khi xóa template." });
    }
  }
}
