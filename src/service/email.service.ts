import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../utils/email";

const prisma = new PrismaClient();

export class EmailService {
  /**
   * Gửi email dựa trên tên template (trong DB) + danh sách người nhận (có params).
   * @param emailType  Tên template (trùng với cột name bên bảng emailTemplate)
   * @param recipients Mảng email + params
   * @param userId     ID người gửi (nếu cần ghi log)
   */
  async sendEmails(
    emailType: string,
    recipients: { email: string; params: Record<string, string> }[],
    userId: string
  ) {
    const template = await prisma.emailTemplate.findUnique({
      where: { name: emailType },
    });
    if (!template) throw new Error(`Không tìm thấy template: ${emailType}`);

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const recipient of recipients) {
      let emailBody = template.body;

      // Thay thế tất cả {{key}} bằng giá trị trong recipient.params
      Object.keys(recipient.params).forEach((key) => {
        const regex = new RegExp(`{{${key}}}`, "g");
        emailBody = emailBody.replace(regex, recipient.params[key] || "N/A");
      });

      try {
        await sendEmail({
          to: recipient.email,
          subject: template.subject,
          html: emailBody,
        });
        successCount++;

        // Lưu log
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
        errors.push(`Gửi email thất bại đến ${recipient.email}: ${(error as Error).message}`);
        console.error(`Lỗi gửi email:`, error);

        await prisma.emailLog.create({
          data: {
            userId,
            recipientEmail: recipient.email,
            subject: template.subject,
            content: emailBody,
            status: "FAILED",
            errorMessage: (error as Error).message,
            errorAt: new Date(),
          },
        });
      }
    }

    return { successCount, failedCount, errors };
  }

  /**
   * Gửi email hàng loạt (không tham số động).
   * Sẽ tìm template theo tên, dùng body + subject cố định.
   */
  async sendBulkEmails(emailType: string, emails: string[], userId: string) {
    if (emails.length === 0) {
      throw new Error("Danh sách email không được để trống.");
    }

    const template = await prisma.emailTemplate.findUnique({
      where: { name: emailType },
    });
    if (!template) throw new Error(`Không tìm thấy template: ${emailType}`);

    let successCount = 0;
    const errors: string[] = [];

    for (const email of emails) {
      try {
        await sendEmail({
          to: email,
          subject: template.subject,
          html: template.body,
        });
        successCount++;

        await prisma.emailLog.create({
          data: {
            userId,
            recipientEmail: email,
            subject: template.subject,
            content: template.body,
            status: "SENT",
            errorAt: new Date(),
          },
        });
      } catch (error) {
        errors.push(`Gửi email thất bại cho: ${email}, lỗi: ${(error as Error).message}`);
      }
    }

    return {
      totalEmails: emails.length,
      successCount,
      failedCount: errors.length,
      errors,
    };
  }

  /**
   * Gửi email linh hoạt (không cần dùng template DB).
   * FE truyền thẳng subject, body, danh sách recipients.
   */
  async sendCustomEmail(subject: string, body: string, recipients: string[], userId: string) {
    if (!recipients || recipients.length === 0) {
      throw new Error("Danh sách recipients không được để trống.");
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const email of recipients) {
      try {
        await sendEmail({
          to: email,
          subject,
          html: body,
        });
        successCount++;

        await prisma.emailLog.create({
          data: {
            userId,
            recipientEmail: email,
            subject,
            content: body,
            status: "SENT",
            errorAt: new Date(),
          },
        });
      } catch (error) {
        failedCount++;
        errors.push(`Gửi email tới ${email} thất bại: ${(error as Error).message}`);
        console.error(`Lỗi gửi email tới ${email}:`, error);

        await prisma.emailLog.create({
          data: {
            userId,
            recipientEmail: email,
            subject,
            content: body,
            status: "FAILED",
            errorMessage: (error as Error).message,
            errorAt: new Date(),
          },
        });
      }
    }

    return { totalEmails: recipients.length, successCount, failedCount, errors };
  }
}
