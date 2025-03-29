import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { EmailService } from "../service/email.service";

const prisma = new PrismaClient();

export class EmailController {
  private emailService = new EmailService();

  constructor() {
    // Khởi tạo service
  }

  // 1. Gửi email dạng template + tham số, TÍCH HỢP luôn logic semester
  async sendEmails(req: Request, res: Response) {
    try {
      // Ngoài emailType, recipients, ta nhận thêm semesterId
      const { emailType, recipients, semesterId } = req.body;
      const userId = req.user?.userId;

      if (!emailType || !recipients || recipients.length === 0 || !userId) {
        return res
          .status(400)
          .json({ message: "Thiếu dữ liệu yêu cầu (emailType, recipients, userId)." });
      }

      // [Option] Nếu có semesterId => Lấy semester từ DB => gắn vào params
      let semester = null;
      if (semesterId) {
        semester = await prisma.semester.findUnique({ where: { id: semesterId } });
        if (!semester) {
          return res.status(404).json({ message: "Không tìm thấy học kỳ tương ứng." });
        }
      }

      // Tạo mảng recipients đã gắn thêm info từ semester
      const newRecipients = recipients.map((r: any) => {
        // r là { email, params } ban đầu
        let mergedParams = { ...r.params };
        if (semester) {
          mergedParams.semesterCode = semester.code;
          mergedParams.semesterStatus = semester.status;
        }
        return {
          email: r.email,
          params: mergedParams,
        };
      });

      // Cuối cùng gọi emailService
      const result = await this.emailService.sendEmails(emailType, newRecipients, userId);

      return res.status(200).json(result);
    } catch (error) {
      const errorMessage = (error as Error).message;
      return res.status(500).json({ message: "Lỗi gửi email.", error: errorMessage });
    }
  }

  // 2. Gửi email dạng template (hàng loạt, ko param) - giữ nguyên
  async sendBulkEmails(req: Request, res: Response) {
    try {
      const { emailType, emails } = req.body;
      const userId = req.user?.userId;

      if (!emailType || !emails || emails.length === 0 || !userId) {
        return res.status(400).json({ message: "Thiếu thông tin bắt buộc." });
      }

      const result = await this.emailService.sendBulkEmails(emailType, emails, userId);
      return res.status(200).json(result);
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Gửi email thất bại.", error: (error as Error).message });
    }
  }

  // 3. Gửi email linh hoạt (không qua template DB) - giữ nguyên
  async sendCustomEmail(req: Request, res: Response) {
    try {
      const { subject, body, recipients } = req.body;
      const userId = req.user?.userId;

      if (!subject || !body || !recipients || recipients.length === 0 || !userId) {
        return res.status(400).json({
          message: "Thiếu thông tin bắt buộc (subject, body, recipients, userId).",
        });
      }

      const result = await this.emailService.sendCustomEmail(subject, body, recipients, userId);
      return res.status(200).json(result);
    } catch (error) {
      console.error("Lỗi gửi email linh hoạt:", error);
      const errorMessage = (error as Error).message;
      return res
        .status(500)
        .json({ message: "Lỗi gửi email linh hoạt.", error: errorMessage });
    }
  }
}
