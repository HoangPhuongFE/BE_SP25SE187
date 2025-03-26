/*
  Warnings:

  - A unique constraint covering the columns `[defense_schedule_id,student_id]` on the table `DefenseMemberResult` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `DefenseMemberResult_defense_schedule_id_student_id_key` ON `DefenseMemberResult`(`defense_schedule_id`, `student_id`);
