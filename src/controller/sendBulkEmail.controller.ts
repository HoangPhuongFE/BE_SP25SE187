import { Request, Response } from "express";
import { sendBulkEmail} from "../service/sendBulkEmail.service";

export class EmailController {
  async sendEmailsByType(req: Request, res: Response) {
    const { semesterId, qualificationStatus, emailType } = req.body;

    if (!semesterId || !emailType) {
      return res.status(400).json({ message: "Thiếu mã học kỳ (semesterId) hoặc loại email (emailType)." });
    }

    try {
      const userId = req.user?.userId; 

      if (!userId) {
        return res.status(401).json({ message: "Không tìm thấy userId trong token. Vui lòng đăng nhập lại." });
      }

      const result = await sendBulkEmail(semesterId, qualificationStatus, emailType, userId);

      return res.status(200).json({
        message: "Đã gửi email thành công.",
        tongSoEmail: result.totalEmails,
        soEmailThanhCong: result.successCount,
        soEmailThatBai: result.failedCount,
        loi: result.errors,
      });
    } catch (error) {
      console.error("Gửi email thất bại:", error);
      return res.status(500).json({ message: "Không thể gửi email. Đã xảy ra lỗi.", error: (error as Error).message });
    }
  }
}

