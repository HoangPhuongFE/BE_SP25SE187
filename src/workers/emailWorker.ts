import { emailQueue } from "../queue/emailQueue";
import { sendEmail } from "../utils/email";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

emailQueue.process(async (job) => {
  // job.data chứa thông tin email
  const { recipientEmail, subject, emailBody, userId } = job.data;
  // Thử gửi
  const emailSent = await sendEmail(recipientEmail, subject, emailBody);
  // Ghi log
  await prisma.emailLog.create({
    data: {
      recipientEmail,
      subject,
      content: emailBody,
      status: emailSent ? "SENT" : "FAILED",
      errorAt: new Date(),
      user: { connect: { id: userId } }
    },
  });
});
