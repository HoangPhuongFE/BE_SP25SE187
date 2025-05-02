-- AlterTable
ALTER TABLE `defense_schedules` ADD COLUMN `major_id` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `defense_schedules` ADD CONSTRAINT `defense_schedules_major_id_fkey` FOREIGN KEY (`major_id`) REFERENCES `majors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
