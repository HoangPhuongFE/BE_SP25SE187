/*
  Warnings:

  - You are about to drop the column `personal_email` on the `students` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `students` DROP COLUMN `personal_email`;

-- AlterTable
ALTER TABLE `system_logs` MODIFY `description` TEXT NULL;
