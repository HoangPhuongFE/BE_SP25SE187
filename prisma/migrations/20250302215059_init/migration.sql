-- AlterTable
ALTER TABLE `councils` ADD COLUMN `submission_period_id` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `councils` ADD CONSTRAINT `councils_submission_period_id_fkey` FOREIGN KEY (`submission_period_id`) REFERENCES `submission_periods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
