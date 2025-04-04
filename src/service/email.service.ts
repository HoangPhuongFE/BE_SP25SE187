import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../utils/email";

const prisma = new PrismaClient();

export class EmailService {
  // Hàm gửi email với template (tái sử dụng trong các phương thức khác)
  private async sendEmailWithTemplate(
    templateId: string,
    recipients: string[],
    data: Record<string, string>,
    userId?: string
  ) {
    const template = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new Error("Không tìm thấy template");

    let emailBody = template.body;
    for (const [key, value] of Object.entries(data)) {
      emailBody = emailBody.replace(`{{${key}}}`, value);
    }

    const emailPromises = recipients.map(async (to) => {
      try {
        await sendEmail({
          to,
          subject: template.subject,
          html: emailBody,
        });

        // Ghi log email
        if (userId) {
          await prisma.emailLog.create({
            data: {
              userId,
              recipientEmail: to,
              subject: template.subject,
              content: emailBody,
              status: "SENT",
              errorAt: new Date(),
            },
          });
        }
      } catch (error) {
        // Ghi log lỗi nếu gửi email thất bại
        if (userId) {
          await prisma.emailLog.create({
            data: {
              userId,
              recipientEmail: to,
              subject: template.subject,
              content: emailBody,
              status: "FAILED",
              errorMessage: String(error),
              errorAt: new Date(),
            },
          });
        }
        throw error;
      }
    });

    await Promise.all(emailPromises);
  }

  // Phương thức gửi email kết quả học kỳ
  async sendSemesterResults(
    semesterId: string,
    passTemplateId: string,
    failTemplateId: string,
    userId?: string
  ) {
    // Kiểm tra input
    if (!semesterId || !passTemplateId || !failTemplateId) {
      throw new Error("Thiếu thông tin: semesterId, passTemplateId hoặc failTemplateId.");
    }

    // Lấy danh sách sinh viên trong học kỳ
    const semesterStudents = await prisma.semesterStudent.findMany({
      where: { semesterId },
      include: {
        student: {
          include: { user: true }, // Lấy email từ User
        },
      },
    });

    if (!semesterStudents.length) {
      throw new Error("Không tìm thấy sinh viên trong học kỳ này.");
    }

    // Phân loại sinh viên
    const passedStudents = semesterStudents.filter(
      (ss) => ss.qualificationStatus === "qualified"
    );
    const failedStudents = semesterStudents.filter(
      (ss) => ss.qualificationStatus === "not qualified"
    );

    // Gửi email cho sinh viên "pass"
    if (passedStudents.length > 0) {
      const passRecipients = passedStudents
        .map((ss) => ss.student?.user?.email)
        .filter(Boolean) as string[];

      await this.sendEmailWithTemplate(
        passTemplateId,
        passRecipients,
        {
          semesterCode: semesterId,
        },
        userId
      );
    }

    // Gửi email cho sinh viên "không pass"
    if (failedStudents.length > 0) {
      const failRecipients = failedStudents
        .map((ss) => ss.student?.user?.email)
        .filter(Boolean) as string[];

      await this.sendEmailWithTemplate(
        failTemplateId,
        failRecipients,
        {
          semesterCode: semesterId,
        },
        userId
      );
    }
  }
}