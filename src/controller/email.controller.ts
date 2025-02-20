import { Request, Response } from "express";
import { EmailService } from "../service/email.service";

export class EmailController {
  private emailService = new EmailService();
  constructor() {
    this.emailService = new EmailService();
  }

  async sendEmails(req: Request, res: Response) {
    try {
      const { emailType, recipients } = req.body;
      const userId = req.user?.userId;

      if (!emailType || !recipients || recipients.length === 0 || !userId) {
        return res.status(400).json({ message: "Thiếu dữ liệu yêu cầu." });
      }

      const result = await this.emailService.sendEmails(emailType, recipients, userId);
      return res.status(200).json(result);
    } catch (error) {
      const errorMessage = (error as Error).message;
      return res.status(500).json({ message: "Lỗi gửi email.", error: errorMessage });
    }
  }

  async sendBulkEmails(req: Request, res: Response) {
    const { emailType, emails } = req.body;
    const userId = req.user?.userId;

    if (!emailType || !emails || emails.length === 0) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc." });
    }

    try {
      const result = await this.emailService.sendBulkEmails(emailType, emails, userId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ message: "Gửi email thất bại.", error: (error as Error).message });
    }
  }
}
