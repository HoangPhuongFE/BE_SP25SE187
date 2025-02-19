/*
  Warnings:

  - You are about to drop the column `registration_deadline` on the `semester` table. All the data in the column will be lost.
  - You are about to drop the `user` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `severity` to the `system_logs` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `decisions` DROP FOREIGN KEY `decisions_created_by_fkey`;

-- DropForeignKey
ALTER TABLE `documents` DROP FOREIGN KEY `documents_uploaded_by_fkey`;

-- DropForeignKey
ALTER TABLE `email_logs` DROP FOREIGN KEY `email_logs_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `group_members` DROP FOREIGN KEY `group_members_student_id_fkey`;

-- DropForeignKey
ALTER TABLE `groups` DROP FOREIGN KEY `groups_created_by_fkey`;

-- DropForeignKey
ALTER TABLE `import_logs` DROP FOREIGN KEY `import_logs_import_by_fkey`;

-- DropForeignKey
ALTER TABLE `notification_recipients` DROP FOREIGN KEY `notification_recipients_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `refreshtoken` DROP FOREIGN KEY `RefreshToken_userId_fkey`;

-- DropForeignKey
ALTER TABLE `review_councils` DROP FOREIGN KEY `review_councils_created_by_fkey`;

-- DropForeignKey
ALTER TABLE `student` DROP FOREIGN KEY `Student_userId_fkey`;

-- DropForeignKey
ALTER TABLE `system_configs` DROP FOREIGN KEY `system_configs_updated_by_fkey`;

-- DropForeignKey
ALTER TABLE `system_logs` DROP FOREIGN KEY `system_logs_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `topics` DROP FOREIGN KEY `topics_created_by_fkey`;

-- DropForeignKey
ALTER TABLE `userrole` DROP FOREIGN KEY `UserRole_userId_fkey`;

-- DropIndex
DROP INDEX `decisions_created_by_fkey` ON `decisions`;

-- DropIndex
DROP INDEX `documents_uploaded_by_fkey` ON `documents`;

-- DropIndex
DROP INDEX `email_logs_user_id_fkey` ON `email_logs`;

-- DropIndex
DROP INDEX `group_members_student_id_fkey` ON `group_members`;

-- DropIndex
DROP INDEX `groups_created_by_fkey` ON `groups`;

-- DropIndex
DROP INDEX `import_logs_import_by_fkey` ON `import_logs`;

-- DropIndex
DROP INDEX `notification_recipients_user_id_fkey` ON `notification_recipients`;

-- DropIndex
DROP INDEX `RefreshToken_userId_fkey` ON `refreshtoken`;

-- DropIndex
DROP INDEX `review_councils_created_by_fkey` ON `review_councils`;

-- DropIndex
DROP INDEX `system_configs_updated_by_fkey` ON `system_configs`;

-- DropIndex
DROP INDEX `system_logs_user_id_fkey` ON `system_logs`;

-- DropIndex
DROP INDEX `topics_created_by_fkey` ON `topics`;

-- AlterTable
ALTER TABLE `email_logs` MODIFY `error_message` TEXT NULL;

-- AlterTable
ALTER TABLE `group_members` ADD COLUMN `user_id` VARCHAR(191) NULL,
    MODIFY `student_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `groupinvitation` ADD COLUMN `expiresAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `groups` ADD COLUMN `topicEnglish` VARCHAR(191) NULL,
    ADD COLUMN `topicTiengViet` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `semester` DROP COLUMN `registration_deadline`;

-- AlterTable
ALTER TABLE `system_logs` ADD COLUMN `description` VARCHAR(191) NULL,
    ADD COLUMN `error` VARCHAR(191) NULL,
    ADD COLUMN `metadata` JSON NULL,
    ADD COLUMN `severity` VARCHAR(191) NOT NULL,
    ADD COLUMN `stack_trace` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `user`;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NULL,
    `avatar` VARCHAR(191) NULL,
    `student_code` VARCHAR(191) NULL,
    `profession` VARCHAR(191) NULL,
    `specialty` VARCHAR(191) NULL,
    `programming_language` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLogin` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_templates` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `email_templates_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Student` ADD CONSTRAINT `Student_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `import_logs` ADD CONSTRAINT `import_logs_import_by_fkey` FOREIGN KEY (`import_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_configs` ADD CONSTRAINT `system_configs_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `topics` ADD CONSTRAINT `topics_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `groups` ADD CONSTRAINT `groups_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `Student`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_logs` ADD CONSTRAINT `system_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_logs` ADD CONSTRAINT `email_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `decisions` ADD CONSTRAINT `decisions_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_councils` ADD CONSTRAINT `review_councils_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_uploaded_by_fkey` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_recipients` ADD CONSTRAINT `notification_recipients_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_templates` ADD CONSTRAINT `email_templates_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
