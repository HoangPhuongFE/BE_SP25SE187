import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../utils/email";

const prisma = new PrismaClient();
/*
function generateEmailContent(studentName: string, studentCode: string, major: string, specialization: string, semester: string, isQualified: boolean): string {
  return `
  <div style="font-family: Arial, sans-serif;">
  <div style="text-align: center;">
      <img src="https://ci3.googleusercontent.com/mail-img-att/AGAZnRrzrxqcIoHNKtEG7sRGYzuWXaDU65OIRdLjk4kKeScrlVVeutfAJgn3TCYnb8CzzmR7zjbbms6nSZJjHRHKVl6nG7MvPzImcR5mBvlZWHDQMW9KzZRTEawCdgIL6JYbGP9DHMMQnQP_tM7RFo0O8_UyCLrLEmYmGRTKP2FXxBosiXYHDMWFyy55l1-2yLENL758V6D-SJXOia8UWWB08XTWkTXTU9E7VCC6u1A4HlH78hU00Tuu_m40K5WERuwtiOs4_XIIaqULrKVO7hg92hazivcYHM9HO4h-dxPomwLu2tiqySZf_BIi3nbL6eHbAI4jFoY0bQFGBYD9qWDtKM9BpzcN3aIxomX7MZvYrjYZa2MfrT_nRnDEe9qeU2hnJi34ML7iC6AkkjyMigPHo8YfTFa41ZmV0XxUEJSW_bYE5GdtfMP9gI_XlIAfGunv4QsQn8K6nA34kWi8IZkOU4zIQiKpwbLvxWRXJZC17letqw8_PEZocU6P2i9LkFQ_tQO0ZDrt0QupMpue8HYqwDBpLJ8PfsdFIAKPicnb4R5xM5X6_WTGN0qz6YSRrdgu--r2DxW-2BA9N4vv4rAD4dVjPPR8D7Vyyuf_55Kj-3aakzb0IRaFahG62M447MdxnaJc6_PgZ1s_KEkkQBR-vL6H8FxCJDxE0bLWuXFeoSzd2rDAbFKJaUuxyIgzDW1Dvk8Jh_1mcmRouHI5SKo8mJFvk_HNZ2-7DhB_ZMqbEeVF3FKYIHi9vDqM6Ie7qJzx4ZrpdVZlukA-35ISt16nCe0cZFUD_soSooh0JYdclWSoKrAsKpC14eCy6tK8C3bYdtK7OlIXc9CUacJSvCmA1TWeT1XATv2Lex_Y0tX5qfMrsj3pILBlKznFl8Z8qZMWuAyzX1itfVa3YXBIUYL3fn1P0xAOaoSJFkYj4y0s0FoT1CyyrHNRA0oesOawd8aH5ffYyUh1rW9fVCcHGUsk6-kt0g5_rUsK0sab7KAcpQRV2WgGFHF-a3cg0rA7aeSd7YN5Av1m3cpkfDpxvqABz6fap9vj=s0-l75-ft" alt="FPT University Logo" style="width: 150px;">
    </div>
    <h2>PHÒNG TỔ CHỨC VÀ QUẢN LÝ ĐÀO TẠO THÔNG BÁO</h2>
    <p>Căn cứ về điều kiện tiên quyết để thực hiện khóa luận tốt nghiệp và kết quả học tập đến thời điểm hiện tại:</p>
    
    <p><strong>Sinh viên:</strong> ${studentName}</p>
    <p><strong>MSSV:</strong> ${studentCode}</p>
    <p><strong>Khóa ngành:</strong> ${major} &nbsp;&nbsp;&nbsp;&nbsp;<strong>Ngành:</strong> ${specialization}</p>
    <p><strong>${isQualified ? "Đủ điều kiện" : "Không đủ điều kiện"} thực hiện khóa luận tốt nghiệp học kỳ ${semester}.</strong></p>
    
    <p>Mọi thắc mắc vui lòng reply lại email: <a href="mailto Hoangnpse161446@fpt.edu.vn">:Hoangnpse161446@fpt.edu.vn</a> để được hỗ trợ.</p>
    
    <p>Thân mến,<br>Phòng Đào Tạo</p>
  </div>
`;

} */
export async function sendBulkEmail(semesterId: string, qualificationStatus: string | undefined, emailType: string, userId: string) {
  const whereClause: any = { semesterId };

  if (qualificationStatus) {
    whereClause.qualificationStatus = qualificationStatus;
  }

  const students = await prisma.semesterStudent.findMany({
    where: whereClause,
    include: { student: { include: { user: true, major: true, specialization: true } } }
  });

  const template = await prisma.emailTemplate.findUnique({ where: { name: emailType } });
  if (!template) throw new Error(`Không tìm thấy template cho loại email: ${emailType}`);

  const semesterRecord = await prisma.semester.findUnique({ where: { id: semesterId } });
  const semester = semesterRecord ? semesterRecord.code : "N/A";

  const emails = students.map((record) => {
    const email = record.student?.user?.email || "";
    const studentName = record.student?.user?.fullName || "Sinh viên";
    const studentCode = record.student?.studentCode || "N/A";
    const major = record.student?.major?.name || "N/A";
    const specialization = record.student?.specialization?.name || "N/A";

    // Thay thế qualificationStatus
    const qualificationStatusText = record.qualificationStatus === "qualified" ? "Đủ điều kiện" : "Không đủ điều kiện";

    let body = template.body;
    body = body.replace(/{{studentName}}/g, studentName)
               .replace(/{{studentCode}}/g, studentCode)
               .replace(/{{major}}/g, major)
               .replace(/{{specialization}}/g, specialization)
               .replace(/{{semester}}/g, semester)
               .replace(/{{qualificationStatus}}/g, qualificationStatusText);

    return { to: email, subject: template.subject, html: body };
  });

  // Gửi email đồng loạt
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
      console.error(`Gửi email thất bại cho: ${emailData.to}`, error);
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




