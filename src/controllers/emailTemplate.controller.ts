import { Request, Response } from "express";
import { EmailTemplateService } from "../services/emailTemplate.service";

const service = new EmailTemplateService();

export class EmailTemplateController {
  async getAllTemplates(req: Request, res: Response) {
    const templates = await service.getAllTemplates();
    return res.status(200).json(templates);
  }

  async getTemplateById(req: Request, res: Response) {
    const template = await service.getTemplateById(req.params.id);
    return res.status(200).json(template);
  }

  async getTemplateParams(req: Request, res: Response) {
    const params = await service.getTemplateParams(req.params.id);
    return res.status(200).json({ params });
  }

  async createTemplate(req: Request, res: Response) {
    const { name, subject, body, description } = req.body;
    const createdBy = req.user?.userId;

    if (!name || !subject || !body) {
      return res.status(400).json({ message: "Thiếu name, subject hoặc body." });
    }

    if (!createdBy) {
      return res.status(401).json({ message: "Không xác định được người tạo." });
    }

    const result = await service.createTemplate({ name, subject, body, description, createdBy });
    return res.status(201).json(result);
  }

  async updateTemplate(req: Request, res: Response) {
    const result = await service.updateTemplate(req.params.id, req.body);
    return res.status(200).json(result);
  }

  async deleteTemplate(req: Request, res: Response) {
    const result = await service.deleteTemplate(req.params.id);
    return res.status(200).json({ message: "Template đã được xóa .", data: result });
  }


}
