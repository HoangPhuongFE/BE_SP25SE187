/*
  Warnings:

  - You are about to drop the column `status` on the `review_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `is_eligible` on the `student` table. All the data in the column will be lost.
  - Added the required column `review_schedule_id` to the `review_assignment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `review_assignment` DROP FOREIGN KEY `review_assignment_reviewer_id_fkey`;

-- DropIndex
DROP INDEX `review_assignment_reviewer_id_fkey` ON `review_assignment`;

-- AlterTable
ALTER TABLE `review_assignment` ADD COLUMN `review_schedule_id` VARCHAR(191) NOT NULL,
    MODIFY `reviewer_id` VARCHAR(191) NULL,
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `review_schedules` DROP COLUMN `status`,
    ADD COLUMN `report_url` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `semesterstudent` MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    MODIFY `qualificationStatus` VARCHAR(191) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `student` DROP COLUMN `is_eligible`,
    MODIFY `status` ENUM('PENDING', 'ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE';

-- AddForeignKey
ALTER TABLE `review_assignment` ADD CONSTRAINT `review_assignment_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_assignment` ADD CONSTRAINT `review_assignment_review_schedule_id_fkey` FOREIGN KEY (`review_schedule_id`) REFERENCES `review_schedules`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
