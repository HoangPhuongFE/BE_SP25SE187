import { Request, Response } from "express";
import { EmailService } from "../service/email.service";

const emailService = new EmailService();

export class EmailController {
  async sendSemesterResults(req: Request, res: Response) {
    try {
      const { semesterId, passTemplateId, failTemplateId } = req.body;

      await emailService.sendSemesterResults(
        semesterId,
        passTemplateId,
        failTemplateId,
        req.user?.userId
      );

      return res.status(200).json({ message: "Email kết quả học kỳ đã được gửi thành công." });
    } catch (error) {
      console.error("Lỗi khi gửi email kết quả học kỳ:", error);
      const errorMessage = error instanceof Error ? error.message : "Lỗi khi gửi email.";
      return res.status(500).json({ message: errorMessage });
    }
  }
}