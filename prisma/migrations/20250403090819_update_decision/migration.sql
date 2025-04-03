-- AlterTable
ALTER TABLE `decisions` ADD COLUMN `clauses_json` VARCHAR(191) NULL,
    ADD COLUMN `participants_json` VARCHAR(191) NULL;
