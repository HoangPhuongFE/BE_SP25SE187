import { schedule } from "node-cron";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Hàm xác định trạng thái của SubmissionPeriod (có thể dùng chung với Semester nếu cùng logic)
function determineStatus(startDate: Date, endDate: Date): string {
  const now = new Date();
  if (now < startDate) {
    return "UPCOMING";
  } else if (now >= startDate && now <= endDate) {
    return "ACTIVE";
  } else {
    return "COMPLETE";
  }
}

// Cron job cập nhật trạng thái của SubmissionPeriod (ví dụ chạy mỗi phút cho kiểm tra nhanh)
schedule("*/1 * * * *", async () => {
  console.log("Đang kiểm tra trạng thái đợt đề xuất...");
  try {
    const periods = await prisma.submissionPeriod.findMany();
    for (const period of periods) {
      const newStatus = determineStatus(new Date(period.startDate), new Date(period.endDate));
      if (newStatus !== period.status) {
        await prisma.submissionPeriod.update({
          where: { id: period.id },
          data: { status: newStatus },
        });
        console.log(`Cập nhật trạng thái đợt đề xuất ${period.id}: ${period.status} -> ${newStatus}`);
      }
    }
    console.log("Cập nhật trạng thái đợt đề xuất hoàn tất.");
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái đợt đề xuất:", error);
  }
});

// Cron job cập nhật lời mời hết hạn (ví dụ chạy mỗi 60 phút)
schedule("*/60 * * * *", async () => {
  console.log("Đang kiểm tra lời mời hết hạn...");
  try {
    await prisma.groupInvitation.updateMany({
      where: {
        status: "PENDING",
        expiresAt: { lte: new Date() },
      },
      data: { status: "EXPIRED" },
    });
    console.log("Cập nhật lời mời hết hạn hoàn tất.");
  } catch (error) {
    console.error("Lỗi khi cập nhật lời mời hết hạn:", error);
  }
});

// Cron job cập nhật trạng thái của Semester (chạy mỗi 15 phút)
schedule("*/15 * * * *", async () => {
  console.log("Đang kiểm tra trạng thái semester...");
  try {
    const semesters = await prisma.semester.findMany();
    for (const semester of semesters) {
      // Giả sử các trường startDate và endDate không null
      const newStatus = determineStatus(new Date(semester.startDate), new Date(semester.endDate));
      if (newStatus !== semester.status) {
        await prisma.semester.update({
          where: { id: semester.id },
          data: { status: newStatus },
        });
        console.log(`Cập nhật trạng thái semester ${semester.id}: ${semester.status} -> ${newStatus}`);
      }
    }
    console.log("Cập nhật trạng thái semester hoàn tất.");
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái semester:", error);
  }
});

// Hàm khởi chạy cron job
export function startCronJobs() {
  console.log("Cron jobs đã được khởi động.");
}
