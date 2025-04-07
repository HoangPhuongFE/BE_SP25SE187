/*
  Warnings:

  - You are about to drop the column `feedback` on the `defense_schedules` table. All the data in the column will be lost.
  - You are about to drop the column `result` on the `defense_schedules` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `defense_schedules` DROP COLUMN `feedback`,
    DROP COLUMN `result`;
