/*
  Warnings:

  - Added the required column `type` to the `submission_periods` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `email_logs` ADD COLUMN `metadata` JSON NULL;

-- AlterTable
ALTER TABLE `submission_periods` ADD COLUMN `type` VARCHAR(191) NOT NULL;
