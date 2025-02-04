/*
  Warnings:

  - The primary key for the `ai_verification_logs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `council_members` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `councils` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `decisions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `defense_schedules` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `detail_major_topic` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `documents` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `email_logs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `feedback` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `group_members` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `groups` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `import_logs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `majors` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `meeting_schedules` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `notification_recipients` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `notifications` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `progress_reports` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `review_assignments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `review_councils` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `review_defense_councils` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `semester` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `semester_topic_major` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `semesterstudent` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `specializations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `student` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `system_configs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `system_logs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `topic_assignments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `topic_registrations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `topics` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `year` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE `_majortopics` DROP FOREIGN KEY `_MajorTopics_A_fkey`;

-- DropForeignKey
ALTER TABLE `_majortopics` DROP FOREIGN KEY `_MajorTopics_B_fkey`;

-- DropForeignKey
ALTER TABLE `ai_verification_logs` DROP FOREIGN KEY `ai_verification_logs_topic_id_fkey`;

-- DropForeignKey
ALTER TABLE `council_members` DROP FOREIGN KEY `council_members_council_id_fkey`;

-- DropForeignKey
ALTER TABLE `councils` DROP FOREIGN KEY `councils_topicass_id_fkey`;

-- DropForeignKey
ALTER TABLE `decisions` DROP FOREIGN KEY `decisions_group_id_fkey`;

-- DropForeignKey
ALTER TABLE `decisions` DROP FOREIGN KEY `decisions_topic_id_fkey`;

-- DropForeignKey
ALTER TABLE `defense_schedules` DROP FOREIGN KEY `defense_schedules_council_id_fkey`;

-- DropForeignKey
ALTER TABLE `defense_schedules` DROP FOREIGN KEY `defense_schedules_group_id_fkey`;

-- DropForeignKey
ALTER TABLE `detail_major_topic` DROP FOREIGN KEY `detail_major_topic_major_id_fkey`;

-- DropForeignKey
ALTER TABLE `detail_major_topic` DROP FOREIGN KEY `detail_major_topic_topic_id_fkey`;

-- DropForeignKey
ALTER TABLE `feedback` DROP FOREIGN KEY `feedback_meeting_id_fkey`;

-- DropForeignKey
ALTER TABLE `group_members` DROP FOREIGN KEY `group_members_group_id_fkey`;

-- DropForeignKey
ALTER TABLE `groups` DROP FOREIGN KEY `groups_semester_id_fkey`;

-- DropForeignKey
ALTER TABLE `notification_recipients` DROP FOREIGN KEY `notification_recipients_notification_id_fkey`;

-- DropForeignKey
ALTER TABLE `progress_reports` DROP FOREIGN KEY `progress_reports_group_id_fkey`;

-- DropForeignKey
ALTER TABLE `review_assignments` DROP FOREIGN KEY `review_assignments_council_id_fkey`;

-- DropForeignKey
ALTER TABLE `review_councils` DROP FOREIGN KEY `review_councils_semester_id_fkey`;

-- DropForeignKey
ALTER TABLE `review_defense_councils` DROP FOREIGN KEY `review_defense_councils_council_id_fkey`;

-- DropForeignKey
ALTER TABLE `review_defense_councils` DROP FOREIGN KEY `review_defense_councils_semester_id_fkey`;

-- DropForeignKey
ALTER TABLE `semester` DROP FOREIGN KEY `Semester_yearId_fkey`;

-- DropForeignKey
ALTER TABLE `semester_topic_major` DROP FOREIGN KEY `semester_topic_major_major_id_fkey`;

-- DropForeignKey
ALTER TABLE `semester_topic_major` DROP FOREIGN KEY `semester_topic_major_semester_id_fkey`;

-- DropForeignKey
ALTER TABLE `semester_topic_major` DROP FOREIGN KEY `semester_topic_major_topic_id_fkey`;

-- DropForeignKey
ALTER TABLE `semesterstudent` DROP FOREIGN KEY `SemesterStudent_semester_id_fkey`;

-- DropForeignKey
ALTER TABLE `semesterstudent` DROP FOREIGN KEY `SemesterStudent_student_id_fkey`;

-- DropForeignKey
ALTER TABLE `specializations` DROP FOREIGN KEY `specializations_major_id_fkey`;

-- DropForeignKey
ALTER TABLE `student` DROP FOREIGN KEY `Student_major_id_fkey`;

-- DropForeignKey
ALTER TABLE `student` DROP FOREIGN KEY `Student_specialization_id_fkey`;

-- DropForeignKey
ALTER TABLE `topic_assignments` DROP FOREIGN KEY `topic_assignments_topic_id_fkey`;

-- DropForeignKey
ALTER TABLE `topic_registrations` DROP FOREIGN KEY `topic_registrations_topic_id_fkey`;

-- DropForeignKey
ALTER TABLE `topics` DROP FOREIGN KEY `topics_semester_id_fkey`;

-- DropIndex
DROP INDEX `ai_verification_logs_topic_id_fkey` ON `ai_verification_logs`;

-- DropIndex
DROP INDEX `council_members_council_id_fkey` ON `council_members`;

-- DropIndex
DROP INDEX `councils_topicass_id_fkey` ON `councils`;

-- DropIndex
DROP INDEX `decisions_group_id_fkey` ON `decisions`;

-- DropIndex
DROP INDEX `decisions_topic_id_fkey` ON `decisions`;

-- DropIndex
DROP INDEX `defense_schedules_council_id_fkey` ON `defense_schedules`;

-- DropIndex
DROP INDEX `defense_schedules_group_id_fkey` ON `defense_schedules`;

-- DropIndex
DROP INDEX `detail_major_topic_topic_id_fkey` ON `detail_major_topic`;

-- DropIndex
DROP INDEX `feedback_meeting_id_fkey` ON `feedback`;

-- DropIndex
DROP INDEX `group_members_group_id_fkey` ON `group_members`;

-- DropIndex
DROP INDEX `groups_semester_id_fkey` ON `groups`;

-- DropIndex
DROP INDEX `progress_reports_group_id_fkey` ON `progress_reports`;

-- DropIndex
DROP INDEX `review_assignments_council_id_fkey` ON `review_assignments`;

-- DropIndex
DROP INDEX `review_councils_semester_id_fkey` ON `review_councils`;

-- DropIndex
DROP INDEX `review_defense_councils_semester_id_fkey` ON `review_defense_councils`;

-- DropIndex
DROP INDEX `Semester_yearId_fkey` ON `semester`;

-- DropIndex
DROP INDEX `semester_topic_major_major_id_fkey` ON `semester_topic_major`;

-- DropIndex
DROP INDEX `semester_topic_major_topic_id_fkey` ON `semester_topic_major`;

-- DropIndex
DROP INDEX `SemesterStudent_student_id_fkey` ON `semesterstudent`;

-- DropIndex
DROP INDEX `specializations_major_id_fkey` ON `specializations`;

-- DropIndex
DROP INDEX `Student_major_id_fkey` ON `student`;

-- DropIndex
DROP INDEX `Student_specialization_id_fkey` ON `student`;

-- DropIndex
DROP INDEX `topic_assignments_topic_id_fkey` ON `topic_assignments`;

-- DropIndex
DROP INDEX `topic_registrations_topic_id_fkey` ON `topic_registrations`;

-- DropIndex
DROP INDEX `topics_semester_id_fkey` ON `topics`;

-- AlterTable
ALTER TABLE `_majortopics` MODIFY `A` VARCHAR(191) NOT NULL,
    MODIFY `B` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `ai_verification_logs` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `topic_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `council_members` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `council_id` VARCHAR(191) NOT NULL,
    MODIFY `defensecouncils_id` VARCHAR(191) NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `councils` DROP PRIMARY KEY,
    MODIFY `council_id` VARCHAR(191) NOT NULL,
    MODIFY `topicass_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`council_id`);

-- AlterTable
ALTER TABLE `decisions` DROP PRIMARY KEY,
    MODIFY `decision_id` VARCHAR(191) NOT NULL,
    MODIFY `group_id` VARCHAR(191) NOT NULL,
    MODIFY `topic_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`decision_id`);

-- AlterTable
ALTER TABLE `defense_schedules` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `council_id` VARCHAR(191) NOT NULL,
    MODIFY `group_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `detail_major_topic` DROP PRIMARY KEY,
    MODIFY `major_id` VARCHAR(191) NOT NULL,
    MODIFY `topic_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`major_id`, `topic_id`);

-- AlterTable
ALTER TABLE `documents` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `email_logs` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `feedback` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `meeting_id` VARCHAR(191) NOT NULL,
    MODIFY `review_assignment_id` VARCHAR(191) NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `group_members` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `group_id` VARCHAR(191) NOT NULL,
    MODIFY `student_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `groups` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `semester_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `import_logs` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `majors` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `meeting_schedules` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `notification_recipients` DROP PRIMARY KEY,
    MODIFY `notification_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`notification_id`, `user_id`);

-- AlterTable
ALTER TABLE `notifications` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `progress_reports` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `group_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `review_assignments` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `council_id` VARCHAR(191) NOT NULL,
    MODIFY `topic_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `review_councils` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `semester_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `review_defense_councils` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `council_id` VARCHAR(191) NOT NULL,
    MODIFY `semester_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `semester` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `yearId` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `semester_topic_major` DROP PRIMARY KEY,
    MODIFY `semester_id` VARCHAR(191) NOT NULL,
    MODIFY `topic_id` VARCHAR(191) NOT NULL,
    MODIFY `major_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`semester_id`, `topic_id`, `major_id`);

-- AlterTable
ALTER TABLE `semesterstudent` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `semester_id` VARCHAR(191) NOT NULL,
    MODIFY `student_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `specializations` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `major_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `student` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `major_id` VARCHAR(191) NOT NULL,
    MODIFY `specialization_id` VARCHAR(191) NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `system_configs` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `system_logs` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `topic_assignments` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `topic_id` VARCHAR(191) NOT NULL,
    MODIFY `group_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `topic_registrations` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `topic_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `topics` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `semester_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `year` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AddForeignKey
ALTER TABLE `Student` ADD CONSTRAINT `Student_major_id_fkey` FOREIGN KEY (`major_id`) REFERENCES `majors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Student` ADD CONSTRAINT `Student_specialization_id_fkey` FOREIGN KEY (`specialization_id`) REFERENCES `specializations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Semester` ADD CONSTRAINT `Semester_yearId_fkey` FOREIGN KEY (`yearId`) REFERENCES `Year`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SemesterStudent` ADD CONSTRAINT `SemesterStudent_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `Semester`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SemesterStudent` ADD CONSTRAINT `SemesterStudent_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `specializations` ADD CONSTRAINT `specializations_major_id_fkey` FOREIGN KEY (`major_id`) REFERENCES `majors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `topic_registrations` ADD CONSTRAINT `topic_registrations_topic_id_fkey` FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `councils` ADD CONSTRAINT `councils_topicass_id_fkey` FOREIGN KEY (`topicass_id`) REFERENCES `topic_assignments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_defense_councils` ADD CONSTRAINT `review_defense_councils_council_id_fkey` FOREIGN KEY (`council_id`) REFERENCES `councils`(`council_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_defense_councils` ADD CONSTRAINT `review_defense_councils_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `Semester`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `topics` ADD CONSTRAINT `topics_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `Semester`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `topic_assignments` ADD CONSTRAINT `topic_assignments_topic_id_fkey` FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `groups` ADD CONSTRAINT `groups_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `Semester`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `progress_reports` ADD CONSTRAINT `progress_reports_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_verification_logs` ADD CONSTRAINT `ai_verification_logs_topic_id_fkey` FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `semester_topic_major` ADD CONSTRAINT `semester_topic_major_topic_id_fkey` FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `semester_topic_major` ADD CONSTRAINT `semester_topic_major_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `Semester`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `semester_topic_major` ADD CONSTRAINT `semester_topic_major_major_id_fkey` FOREIGN KEY (`major_id`) REFERENCES `majors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `decisions` ADD CONSTRAINT `decisions_topic_id_fkey` FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `decisions` ADD CONSTRAINT `decisions_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_councils` ADD CONSTRAINT `review_councils_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `Semester`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_assignments` ADD CONSTRAINT `review_assignments_council_id_fkey` FOREIGN KEY (`council_id`) REFERENCES `councils`(`council_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `council_members` ADD CONSTRAINT `council_members_council_id_fkey` FOREIGN KEY (`council_id`) REFERENCES `councils`(`council_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_meeting_id_fkey` FOREIGN KEY (`meeting_id`) REFERENCES `meeting_schedules`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `defense_schedules` ADD CONSTRAINT `defense_schedules_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `defense_schedules` ADD CONSTRAINT `defense_schedules_council_id_fkey` FOREIGN KEY (`council_id`) REFERENCES `councils`(`council_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_recipients` ADD CONSTRAINT `notification_recipients_notification_id_fkey` FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detail_major_topic` ADD CONSTRAINT `detail_major_topic_major_id_fkey` FOREIGN KEY (`major_id`) REFERENCES `majors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detail_major_topic` ADD CONSTRAINT `detail_major_topic_topic_id_fkey` FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_MajorTopics` ADD CONSTRAINT `_MajorTopics_A_fkey` FOREIGN KEY (`A`) REFERENCES `majors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_MajorTopics` ADD CONSTRAINT `_MajorTopics_B_fkey` FOREIGN KEY (`B`) REFERENCES `topics`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
