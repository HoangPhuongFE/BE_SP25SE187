import { Request, Response } from "express";
import { EmailService } from "../service/sendBulkEmail.service";

const emailService = new EmailService();

export class EmailController {
  async sendQualificationEmails(req: Request, res: Response) {
    const { semesterId, qualificationStatus, emailType } = req.body;
    const userId = req.user?.userId;

    if (!semesterId || !emailType || !userId) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc." });
    }

    try {
      const result = await emailService.sendQualificationEmails(semesterId, qualificationStatus, emailType, userId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ message: "Gửi email thất bại.", error: (error as Error).message });
    }
  }

  async sendGroupFormationEmails(req: Request, res: Response) {
    const { semesterId, emailType } = req.body;
    const userId = req.user?.userId;

    if (!semesterId || !emailType || !userId) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc." });
    }

    try {
      const result = await emailService.sendGroupFormationEmails(semesterId, emailType, userId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ message: "Gửi email thất bại.", error: (error as Error).message });
    }
  }
}
