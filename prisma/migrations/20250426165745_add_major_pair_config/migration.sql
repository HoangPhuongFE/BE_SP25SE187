-- AlterTable
ALTER TABLE `groups` ADD COLUMN `major_pair_config_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `topics` ADD COLUMN `isInterMajor` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `major_pair_config_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `major_pair_configs` (
    `id` VARCHAR(191) NOT NULL,
    `first_major_id` VARCHAR(191) NOT NULL,
    `second_major_id` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `topics` ADD CONSTRAINT `topics_major_pair_config_id_fkey` FOREIGN KEY (`major_pair_config_id`) REFERENCES `major_pair_configs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `groups` ADD CONSTRAINT `groups_major_pair_config_id_fkey` FOREIGN KEY (`major_pair_config_id`) REFERENCES `major_pair_configs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `major_pair_configs` ADD CONSTRAINT `major_pair_configs_first_major_id_fkey` FOREIGN KEY (`first_major_id`) REFERENCES `majors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `major_pair_configs` ADD CONSTRAINT `major_pair_configs_second_major_id_fkey` FOREIGN KEY (`second_major_id`) REFERENCES `majors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
