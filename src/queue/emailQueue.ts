import Bull from "bull";
import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../utils/email";

const prisma = new PrismaClient();

export const emailQueue = new Bull("emailQueue", {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379,
  },
});

// Xử lý job trong hàng đợi
emailQueue.process(async (job) => {
  const { recipientEmail, subject, emailBody, userId } = job.data;

  if (!recipientEmail || !subject || !emailBody || !userId) {
    const errorMsg = `Dữ liệu job không hợp lệ: ${JSON.stringify(job.data)}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    const emailSent = await sendEmail(recipientEmail, subject, emailBody);
    const logData: any = {
      recipientEmail,
      subject,
      content: emailBody,
      status: emailSent ? "SENT" : "FAILED",
      user: { connect: { id: userId } },
    };

    // Chỉ thêm errorAt nếu email thất bại
    if (!emailSent) {
      logData.errorAt = new Date(); // Gán Date khi thất bại
    }

    await prisma.emailLog.create({ data: logData });
    console.log(`Job ${job.id} hoàn thành: Email tới ${recipientEmail} - ${emailSent ? "Thành công" : "Thất bại"}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Lỗi xử lý job ${job.id}: ${error.message}`);
    } else {
      console.error(`Lỗi xử lý job ${job.id}: ${String(error)}`);
    }
    throw error;
  }
});

// Log khi job thất bại
emailQueue.on("failed", (job, err) => {
  console.error(`Job ${job.id} thất bại sau ${job.attemptsMade} lần thử: ${err.message}`);
});

// Log khi job hoàn thành
emailQueue.on("completed", (job) => {
  console.log(`Job ${job.id} hoàn thành thành công`);
});