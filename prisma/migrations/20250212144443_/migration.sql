-- DropForeignKey
ALTER TABLE `semester` DROP FOREIGN KEY `Semester_yearId_fkey`;

-- DropIndex
DROP INDEX `Semester_yearId_fkey` ON `semester`;

-- DropIndex
DROP INDEX `Year_year_key` ON `year`;

-- AddForeignKey
ALTER TABLE `Semester` ADD CONSTRAINT `Semester_yearId_fkey` FOREIGN KEY (`yearId`) REFERENCES `Year`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
