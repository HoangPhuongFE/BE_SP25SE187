/*
  Warnings:

  - A unique constraint covering the columns `[semester_id,first_major_id,second_major_id]` on the table `major_pair_configs` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `major_pair_configs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `semester_id` to the `major_pair_configs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `major_pair_configs` ADD COLUMN `name` VARCHAR(191) NOT NULL,
    ADD COLUMN `semester_id` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `major_pair_configs_semester_id_first_major_id_second_major_i_key` ON `major_pair_configs`(`semester_id`, `first_major_id`, `second_major_id`);

-- AddForeignKey
ALTER TABLE `major_pair_configs` ADD CONSTRAINT `major_pair_configs_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
