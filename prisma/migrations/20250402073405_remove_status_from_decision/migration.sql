/*
  Warnings:

  - You are about to drop the column `status` on the `decisions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `decisions` DROP COLUMN `status`,
    ADD COLUMN `based_on_json` VARCHAR(191) NULL,
    ADD COLUMN `content` VARCHAR(191) NULL,
    ADD COLUMN `decision_date` DATETIME(3) NULL,
    ADD COLUMN `proposal` VARCHAR(191) NULL;
