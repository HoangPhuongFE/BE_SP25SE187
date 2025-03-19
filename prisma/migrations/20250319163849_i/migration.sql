/*
  Warnings:

  - You are about to drop the column `decision_number` on the `decisions` table. All the data in the column will be lost.
  - You are about to drop the column `group_id` on the `decisions` table. All the data in the column will be lost.
  - You are about to drop the column `topic_id` on the `decisions` table. All the data in the column will be lost.
  - You are about to drop the column `decision_file` on the `topic_assignments` table. All the data in the column will be lost.
  - You are about to drop the column `decision_id` on the `topic_assignments` table. All the data in the column will be lost.
  - Added the required column `decision_name` to the `decisions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `council_members` DROP FOREIGN KEY `council_members_council_id_fkey`;

-- DropForeignKey
ALTER TABLE `decisions` DROP FOREIGN KEY `decisions_group_id_fkey`;

-- DropForeignKey
ALTER TABLE `decisions` DROP FOREIGN KEY `decisions_topic_id_fkey`;

-- DropIndex
DROP INDEX `council_members_council_id_fkey` ON `council_members`;

-- DropIndex
DROP INDEX `decisions_group_id_fkey` ON `decisions`;

-- DropIndex
DROP INDEX `decisions_topic_id_fkey` ON `decisions`;

-- AlterTable
ALTER TABLE `decisions` DROP COLUMN `decision_number`,
    DROP COLUMN `group_id`,
    DROP COLUMN `topic_id`,
    ADD COLUMN `decisionURL` VARCHAR(191) NULL,
    ADD COLUMN `decision_name` VARCHAR(191) NOT NULL,
    MODIFY `decision_title` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `topic_assignments` DROP COLUMN `decision_file`,
    DROP COLUMN `decision_id`;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `department` VARCHAR(191) NULL,
    ADD COLUMN `departmentPosition` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `council_members` ADD CONSTRAINT `council_members_council_id_fkey` FOREIGN KEY (`council_id`) REFERENCES `councils`(`council_id`) ON DELETE CASCADE ON UPDATE CASCADE;
