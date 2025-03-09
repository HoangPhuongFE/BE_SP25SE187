/*
  Warnings:

  - The primary key for the `decisions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `decision_id` on the `decisions` table. All the data in the column will be lost.
  - The required column `id` was added to the `decisions` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE `decisions` DROP PRIMARY KEY,
    DROP COLUMN `decision_id`,
    ADD COLUMN `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- CreateTable
CREATE TABLE `ProgressReportMentor` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `mentorId` VARCHAR(191) NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `readAt` DATETIME(3) NULL,

    UNIQUE INDEX `ProgressReportMentor_reportId_mentorId_key`(`reportId`, `mentorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProgressReportMentor` ADD CONSTRAINT `ProgressReportMentor_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `progress_reports`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgressReportMentor` ADD CONSTRAINT `ProgressReportMentor_mentorId_fkey` FOREIGN KEY (`mentorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
