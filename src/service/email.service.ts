import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../utils/email";

const prisma = new PrismaClient();

export class EmailService {
  // ✅ Gửi email cho danh sách người nhận có tham số động
  async sendEmails(emailType: string, recipients: { email: string; params: Record<string, string> }[], userId: string) {
    const template = await prisma.emailTemplate.findUnique({ where: { name: emailType } });
    if (!template) throw new Error(`Không tìm thấy template: ${emailType}`);

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const recipient of recipients) {
      let emailBody = template.body;

      // **Kiểm tra & thay thế params trong template**
      Object.keys(recipient.params).forEach((key) => {
        emailBody = emailBody.replace(new RegExp(`{{${key}}}`, "g"), recipient.params[key] || "N/A");
      });

      try {
        await sendEmail({
          to: recipient.email,
          subject: template.subject,
          html: emailBody,
        });

        successCount++;

        // ✅ Lưu log email vào database
        await prisma.emailLog.create({
          data: {
            userId,
            recipientEmail: recipient.email,
            subject: template.subject,
            content: emailBody,
            status: "SENT",
            errorAt: new Date(),
          },
        });
      } catch (error) {
        failedCount++;
        errors.push(`❌ Lỗi gửi email tới ${recipient.email}`);
        console.error(`❌ Lỗi gửi email:`, error);

        await prisma.emailLog.create({
          data: {
            userId,
            recipientEmail: recipient.email,
            subject: template.subject,
            content: emailBody,
            status: "FAILED",
            errorMessage: (error as any).message,
            errorAt: new Date(),
          },
        });
      }
    }

    return { successCount, failedCount, errors };
  }

  // ✅ Gửi email hàng loạt mà không cần tham số động
  async sendBulkEmails(emailType: string, emails: string[], userId: string) {
    if (emails.length === 0) {
      throw new Error("Danh sách email không được để trống.");
    }

    const template = await prisma.emailTemplate.findUnique({ where: { name: emailType } });
    if (!template) throw new Error(`Không tìm thấy template: ${emailType}`);

    let successCount = 0;
    const errors: string[] = [];

    for (const email of emails) {
      let body = template.body;
      body = body.replace(/{{studentName}}/g, "Sinh viên")
                 .replace(/{{semester}}/g, "Học kỳ hiện tại");

      try {
        await sendEmail({ to: email, subject: template.subject, html: body });
        successCount++;

        await prisma.emailLog.create({
          data: {
            userId,
            recipientEmail: email,
            subject: template.subject,
            content: body,
            status: "SENT",
            errorAt: new Date(),
          },
        });
      } catch (error) {
        errors.push(`Gửi email thất bại cho: ${email}`);
      }
    }

    return { totalEmails: emails.length, successCount, failedCount: errors.length, errors };
  }
}
