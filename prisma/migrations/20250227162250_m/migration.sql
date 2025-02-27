-- DropForeignKey
ALTER TABLE `councils` DROP FOREIGN KEY `councils_topicass_id_fkey`;

-- DropIndex
DROP INDEX `councils_topicass_id_fkey` ON `councils`;

-- AlterTable
ALTER TABLE `councils` MODIFY `topicass_id` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `councils` ADD CONSTRAINT `councils_topicass_id_fkey` FOREIGN KEY (`topicass_id`) REFERENCES `topic_assignments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
