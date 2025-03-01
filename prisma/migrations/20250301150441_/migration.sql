/*
  Warnings:

  - Added the required column `name_project` to the `topics` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `topics` ADD COLUMN `name_project` VARCHAR(191) NOT NULL;
