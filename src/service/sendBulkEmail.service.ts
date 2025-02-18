import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../utils/email";

const prisma = new PrismaClient();

export class EmailService {
 
  async sendQualificationEmails(semesterId: string, qualificationStatus: string | undefined, emailType: string, userId: string) {
    const whereClause: any = { semesterId };
    if (qualificationStatus) {
      whereClause.qualificationStatus = qualificationStatus;
    }

    const students = await prisma.semesterStudent.findMany({
      where: whereClause,
      include: { student: { include: { user: true, major: true, specialization: true } } }
    });

    return this.sendEmails(students, emailType, userId);
  }


  async sendGroupFormationEmails(semesterId: string, emailType: string, userId: string) {
    const groups = await prisma.group.findMany({
      where: { semesterId },
      include: { members: { include: { student: { include: { user: true } } } } }
    });

    const students = groups.flatMap(group => group.members.map(member => member.student));
    return this.sendEmails(students, emailType, userId);
  }


  private async sendEmails(students: any[], emailType: string, userId: string) {
    const template = await prisma.emailTemplate.findUnique({ where: { name: emailType } });
    if (!template) throw new Error(`Không tìm thấy template cho loại email: ${emailType}`);

    const emails = students.map((record) => {
      const email = record.user?.email || "";
      const studentName = record.user?.fullName || "Sinh viên";
      const studentCode = record.studentCode || "N/A";
      const major = record.major?.name || "N/A";
      const specialization = record.specialization?.name || "N/A";
      const semester = "Học kỳ hiện tại";

      let body = template.body;
      body = body.replace(/{{studentName}}/g, studentName)
                 .replace(/{{studentCode}}/g, studentCode)
                 .replace(/{{major}}/g, major)
                 .replace(/{{specialization}}/g, specialization)
                 .replace(/{{semester}}/g, semester);

      return { to: email, subject: template.subject, html: body };
    });

    let successCount = 0;
    const errors: string[] = [];

    for (const emailData of emails) {
      try {
        await sendEmail(emailData);
        successCount++;
        await prisma.emailLog.create({
          data: {
            userId,
            recipientEmail: emailData.to,
            subject: emailData.subject,
            content: emailData.html,
            status: "success",
            errorAt: new Date(),
          },
        });
      } catch (error) {
        errors.push(`Gửi email thất bại cho: ${emailData.to}`);
        await prisma.emailLog.create({
          data: {
            userId,
            recipientEmail: emailData.to,
            subject: emailData.subject,
            content: emailData.html,
            status: "failed",
            errorMessage: (error as Error).message,
            errorAt: new Date(),
          },
        });
      }
    }

    return { totalEmails: emails.length, successCount, failedCount: errors.length, errors };
  }
}
