import { schedule } from "node-cron";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Chạy job mỗi 15 phút để cập nhật lời mời hết hạn
schedule("*/15 * * * *", async () => {
    console.log(" Đang kiểm tra lời mời hết hạn...");

    await prisma.groupInvitation.updateMany({
        where: {
            status: "PENDING",
            expiresAt: { lte: new Date() }, 
        },
        data: { status: "EXPIRED" },
    });

    console.log("Cập nhật lời mời hết hạn hoàn tất.");
});

export function startCronJobs() {
    console.log(" Cron jobs đã được khởi động.");
}
