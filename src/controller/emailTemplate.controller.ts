import { Request, Response } from "express";
import { EmailTemplateService } from "../service/emailTemplate.service";

export class EmailTemplateController {
  private emailTemplateService = new EmailTemplateService();

  async getAllTemplates(req: Request, res: Response) {
    try {
      const templates = await this.emailTemplateService.getAllTemplates();
      return res.status(200).json(templates);
    } catch (error) {
      console.error("Lỗi khi lấy danh sách template:", error);
      return res.status(500).json({ message: "Không thể lấy danh sách template." });
    }
  }

  async getTemplateById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const template = await this.emailTemplateService.getTemplateById(id);

      if (!template) {
        return res.status(404).json({ message: "Không tìm thấy template." });
      }

      return res.status(200).json(template);
    } catch (error) {
      console.error("Lỗi khi lấy chi tiết template:", error);
      return res.status(500).json({ message: "Không thể lấy chi tiết template." });
    }
  }

  async createTemplate(req: Request, res: Response) {
    try {
      const { name, subject, body, description } = req.body;
      const createdById = req.user?.userId;  // Lấy userId từ token đã giải mã

      if (!createdById) {
        return res.status(401).json({ message: "Không có quyền truy cập. Thiếu thông tin User ID." });
      }

      // Kiểm tra User có tồn tại không
      const user = await this.emailTemplateService.checkUserExists(createdById);
      if (!user) {
        return res.status(404).json({ message: "Người dùng không tồn tại. Không thể tạo template." });
      }

      const newTemplate = await this.emailTemplateService.createTemplate({
        name,
        subject,
        body,
        description,
        createdByUser: {
          connect: { id: createdById }
        }
      });

      return res.status(201).json(newTemplate);
    } catch (error) {
      console.error("Lỗi khi tạo template:", error);
      return res.status(500).json({ message: "Không thể tạo template." });
    }
  }

  async updateTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, subject, body, description } = req.body;

      const updatedTemplate = await this.emailTemplateService.updateTemplate(id, {
        name,
        subject,
        body,
        description,
      });

      if (!updatedTemplate) {
        return res.status(404).json({ message: "Không tìm thấy template cần cập nhật." });
      }

      return res.status(200).json(updatedTemplate);
    } catch (error) {
      console.error("Lỗi khi cập nhật template:", error);
      return res.status(500).json({ message: "Không thể cập nhật template." });
    }
  }

  async deleteTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const deletedTemplate = await this.emailTemplateService.deleteTemplate(id);

      if (!deletedTemplate) {
        return res.status(404).json({ message: "Không tìm thấy template cần xóa." });
      }

      return res.status(200).json({ message: "Template đã được xóa thành công." });
    } catch (error) {
      console.error("Lỗi khi xóa template:", error);
      return res.status(500).json({ message: "Không thể xóa template." });
    }
  }
}
