import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../utils/email";

const prisma = new PrismaClient();

function generateEmailContent(studentName: string, studentCode: string, major: string, specialization: string, semester: string, isQualified: boolean): string {
  return `
    <div style="font-family: Arial, sans-serif;">
      <h2>THÔNG BÁO ĐIỀU KIỆN KHÓA LUẬN</h2>
      <p><strong>Sinh viên:</strong> ${studentName}<br>
      <strong>MSSV:</strong> ${studentCode}<br>
      <strong>Ngành:</strong> ${major}<br>
      <strong>Chuyên ngành:</strong> ${specialization}</p>
      <p>${isQualified ? "Đủ điều kiện" : "Không đủ điều kiện"} thực hiện khóa luận tốt nghiệp.</p>
      <p>Học kỳ: ${semester}</p>
      <p>Trân trọng,<br>Phòng Đào Tạo</p>
    </div>
  `;
}

export async function sendBulkEmailByQualification(semesterId: string, qualificationStatus: string, userId: string) {
    const students = await prisma.semesterStudent.findMany({
      where: {
        semesterId,
        qualificationStatus,
      },
      include: {
        student: {
          include: {
            user: true,
            major: true,
            specialization: true,
          },
        },
      },
    });
  
    const semesterRecord = await prisma.semester.findUnique({
      where: { id: semesterId },
    });
    const semester = semesterRecord ? semesterRecord.code : "N/A";
  
    const emails = students.map((record) => {
      const email = record.student?.user?.email || "";
      const studentName = record.student?.user?.fullName || "Sinh viên";
      const studentCode = record.student?.studentCode || "N/A";
      const major = record.student?.major?.name || "N/A";
      const specialization = record.student?.specialization?.name || "N/A";
      const isQualified = record.qualificationStatus === "qualified";
  
      const subject = `Thông báo điều kiện khóa luận học kỳ ${semester}`;
      const html = generateEmailContent(studentName, studentCode, major, specialization, semester, isQualified);
  
      return { to: email, subject, html };
    });
  
    let successCount = 0;
    const errors: string[] = [];
  
    for (const emailData of emails) {
        try {
          await sendEmail(emailData);
          successCount++;
      
          if (userId) {
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
          }
        } catch (error) {
          console.error(`Gửi email thất bại cho: ${emailData.to}`, error);
          errors.push(`Gửi email thất bại cho: ${emailData.to}`);
      
          if (userId) {
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
      }
      
  
    return {
      totalEmails: emails.length,
      successCount,
      failedCount: errors.length,
      errors,
    };
  }
  
