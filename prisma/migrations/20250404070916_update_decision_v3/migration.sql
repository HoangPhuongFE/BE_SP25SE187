-- AlterTable
ALTER TABLE `decisions` ADD COLUMN `type` ENUM('DRAFT', 'FINAL') NULL;
