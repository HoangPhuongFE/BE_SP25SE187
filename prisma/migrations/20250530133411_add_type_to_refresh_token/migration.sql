-- AlterTable
ALTER TABLE `refresh_token` ADD COLUMN `type` VARCHAR(191) NOT NULL DEFAULT 'reset_password';
