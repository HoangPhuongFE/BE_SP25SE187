-- DropForeignKey
ALTER TABLE `ai_verification_logs` DROP FOREIGN KEY `ai_verification_logs_topic_id_fkey`;

-- DropForeignKey
ALTER TABLE `council_members` DROP FOREIGN KEY `council_members_council_id_fkey`;

-- DropForeignKey
ALTER TABLE `councils` DROP FOREIGN KEY `councils_semester_id_fkey`;

-- DropForeignKey
ALTER TABLE `councils` DROP FOREIGN KEY `councils_submission_period_id_fkey`;

-- DropForeignKey
ALTER TABLE `decisions` DROP FOREIGN KEY `decisions_semesterId_fkey`;

-- DropForeignKey
ALTER TABLE `defenseschedule` DROP FOREIGN KEY `DefenseSchedule_council_id_fkey`;

-- DropForeignKey
ALTER TABLE `defenseschedule` DROP FOREIGN KEY `DefenseSchedule_group_id_fkey`;

-- DropForeignKey
ALTER TABLE `detail_major_topic` DROP FOREIGN KEY `detail_major_topic_topic_id_fkey`;

-- DropForeignKey
ALTER TABLE `documents` DROP FOREIGN KEY `documents_council_id_fkey`;

-- DropForeignKey
ALTER TABLE `documents` DROP FOREIGN KEY `documents_group_id_fkey`;

-- DropForeignKey
ALTER TABLE `documents` DROP FOREIGN KEY `documents_topic_id_fkey`;

-- DropForeignKey
ALTER TABLE `group_members` DROP FOREIGN KEY `group_members_group_id_fkey`;

-- DropForeignKey
ALTER TABLE `group_members` DROP FOREIGN KEY `group_members_student_id_fkey`;

-- DropForeignKey
ALTER TABLE `group_members` DROP FOREIGN KEY `group_members_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `groupinvitation` DROP FOREIGN KEY `GroupInvitation_group_id_fkey`;

-- DropForeignKey
ALTER TABLE `groupinvitation` DROP FOREIGN KEY `GroupInvitation_student_id_fkey`;

-- DropForeignKey
ALTER TABLE `groupmentor` DROP FOREIGN KEY `GroupMentor_group_id_fkey`;

-- DropForeignKey
ALTER TABLE `groups` DROP FOREIGN KEY `groups_semester_id_fkey`;

-- DropForeignKey
ALTER TABLE `progress_reports` DROP FOREIGN KEY `progress_reports_group_id_fkey`;

-- DropForeignKey
ALTER TABLE `review_assignment` DROP FOREIGN KEY `review_assignment_council_id_fkey`;

-- DropForeignKey
ALTER TABLE `review_assignment` DROP FOREIGN KEY `review_assignment_topic_id_fkey`;

-- DropForeignKey
ALTER TABLE `review_defense_councils` DROP FOREIGN KEY `review_defense_councils_council_id_fkey`;

-- DropForeignKey
ALTER TABLE `review_defense_councils` DROP FOREIGN KEY `review_defense_councils_semester_id_fkey`;

-- DropForeignKey
ALTER TABLE `review_schedules` DROP FOREIGN KEY `review_schedules_council_id_fkey`;

-- DropForeignKey
ALTER TABLE `review_schedules` DROP FOREIGN KEY `review_schedules_group_id_fkey`;

-- DropForeignKey
ALTER TABLE `review_schedules` DROP FOREIGN KEY `review_schedules_topicId_fkey`;

-- DropForeignKey
ALTER TABLE `semester_topic_major` DROP FOREIGN KEY `semester_topic_major_semester_id_fkey`;

-- DropForeignKey
ALTER TABLE `semester_topic_major` DROP FOREIGN KEY `semester_topic_major_topic_id_fkey`;

-- DropForeignKey
ALTER TABLE `semesters` DROP FOREIGN KEY `semesters_yearId_fkey`;

-- DropForeignKey
ALTER TABLE `semesterstudent` DROP FOREIGN KEY `SemesterStudent_semester_id_fkey`;

-- DropForeignKey
ALTER TABLE `semesterstudent` DROP FOREIGN KEY `SemesterStudent_student_id_fkey`;

-- DropForeignKey
ALTER TABLE `submission_periods` DROP FOREIGN KEY `submission_periods_semester_id_fkey`;

-- DropForeignKey
ALTER TABLE `topic_assignments` DROP FOREIGN KEY `topic_assignments_group_id_fkey`;

-- DropForeignKey
ALTER TABLE `topic_assignments` DROP FOREIGN KEY `topic_assignments_topic_id_fkey`;

-- DropForeignKey
ALTER TABLE `topic_registrations` DROP FOREIGN KEY `topic_registrations_submission_period_id_fkey`;

-- DropForeignKey
ALTER TABLE `topic_registrations` DROP FOREIGN KEY `topic_registrations_topic_id_fkey`;

-- DropForeignKey
ALTER TABLE `topics` DROP FOREIGN KEY `topics_semester_id_fkey`;

-- DropForeignKey
ALTER TABLE `topics` DROP FOREIGN KEY `topics_submission_period_id_fkey`;

-- DropForeignKey
ALTER TABLE `userrole` DROP FOREIGN KEY `UserRole_semester_id_fkey`;

-- DropIndex
DROP INDEX `ai_verification_logs_topic_id_fkey` ON `ai_verification_logs`;

-- DropIndex
DROP INDEX `council_members_council_id_fkey` ON `council_members`;

-- DropIndex
DROP INDEX `councils_semester_id_fkey` ON `councils`;

-- DropIndex
DROP INDEX `councils_submission_period_id_fkey` ON `councils`;

-- DropIndex
DROP INDEX `decisions_semesterId_fkey` ON `decisions`;

-- DropIndex
DROP INDEX `DefenseSchedule_council_id_fkey` ON `defenseschedule`;

-- DropIndex
DROP INDEX `DefenseSchedule_group_id_fkey` ON `defenseschedule`;

-- DropIndex
DROP INDEX `detail_major_topic_topic_id_fkey` ON `detail_major_topic`;

-- DropIndex
DROP INDEX `documents_council_id_fkey` ON `documents`;

-- DropIndex
DROP INDEX `documents_group_id_fkey` ON `documents`;

-- DropIndex
DROP INDEX `documents_topic_id_fkey` ON `documents`;

-- DropIndex
DROP INDEX `group_members_group_id_fkey` ON `group_members`;

-- DropIndex
DROP INDEX `group_members_student_id_fkey` ON `group_members`;

-- DropIndex
DROP INDEX `group_members_user_id_fkey` ON `group_members`;

-- DropIndex
DROP INDEX `GroupInvitation_group_id_fkey` ON `groupinvitation`;

-- DropIndex
DROP INDEX `GroupInvitation_student_id_fkey` ON `groupinvitation`;

-- DropIndex
DROP INDEX `progress_reports_group_id_fkey` ON `progress_reports`;

-- DropIndex
DROP INDEX `review_assignment_council_id_fkey` ON `review_assignment`;

-- DropIndex
DROP INDEX `review_assignment_topic_id_fkey` ON `review_assignment`;

-- DropIndex
DROP INDEX `review_defense_councils_semester_id_fkey` ON `review_defense_councils`;

-- DropIndex
DROP INDEX `review_schedules_council_id_fkey` ON `review_schedules`;

-- DropIndex
DROP INDEX `review_schedules_group_id_fkey` ON `review_schedules`;

-- DropIndex
DROP INDEX `review_schedules_topicId_fkey` ON `review_schedules`;

-- DropIndex
DROP INDEX `semester_topic_major_topic_id_fkey` ON `semester_topic_major`;

-- DropIndex
DROP INDEX `semesters_yearId_fkey` ON `semesters`;

-- DropIndex
DROP INDEX `SemesterStudent_student_id_fkey` ON `semesterstudent`;

-- DropIndex
DROP INDEX `submission_periods_semester_id_fkey` ON `submission_periods`;

-- DropIndex
DROP INDEX `topic_assignments_group_id_fkey` ON `topic_assignments`;

-- DropIndex
DROP INDEX `topic_assignments_topic_id_fkey` ON `topic_assignments`;

-- DropIndex
DROP INDEX `topic_registrations_submission_period_id_fkey` ON `topic_registrations`;

-- DropIndex
DROP INDEX `topic_registrations_topic_id_fkey` ON `topic_registrations`;

-- DropIndex
DROP INDEX `topics_semester_id_fkey` ON `topics`;

-- DropIndex
DROP INDEX `topics_submission_period_id_fkey` ON `topics`;

-- DropIndex
DROP INDEX `UserRole_semester_id_fkey` ON `userrole`;

-- AlterTable
ALTER TABLE `ai_verification_logs` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `council_members` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `councils` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `decisions` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `defenseschedule` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `detail_major_topic` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `documents` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `email_logs` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `email_templates` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `feedback` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `group_members` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `groupinvitation` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `groupmentor` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `groups` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `import_logs` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `majors` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `meeting_schedules` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `notification_recipients` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `notifications` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `progress_reports` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `progressreportmentor` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `refreshtoken` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `review_assignment` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `review_defense_councils` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `review_schedules` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `role` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `semester_topic_major` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `semesterstudent` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `specializations` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `submission_periods` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `system_configs` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `system_logs` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `topic_assignments` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `topic_registrations` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `topics` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `userrole` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `semesters` ADD CONSTRAINT `semesters_yearId_fkey` FOREIGN KEY (`yearId`) REFERENCES `Year`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SemesterStudent` ADD CONSTRAINT `SemesterStudent_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SemesterStudent` ADD CONSTRAINT `SemesterStudent_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `topic_registrations` ADD CONSTRAINT `topic_registrations_topic_id_fkey` FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `topic_registrations` ADD CONSTRAINT `topic_registrations_submission_period_id_fkey` FOREIGN KEY (`submission_period_id`) REFERENCES `submission_periods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `councils` ADD CONSTRAINT `councils_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `councils` ADD CONSTRAINT `councils_submission_period_id_fkey` FOREIGN KEY (`submission_period_id`) REFERENCES `submission_periods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_defense_councils` ADD CONSTRAINT `review_defense_councils_council_id_fkey` FOREIGN KEY (`council_id`) REFERENCES `councils`(`council_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_defense_councils` ADD CONSTRAINT `review_defense_councils_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `topics` ADD CONSTRAINT `topics_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `topics` ADD CONSTRAINT `topics_submission_period_id_fkey` FOREIGN KEY (`submission_period_id`) REFERENCES `submission_periods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `topic_assignments` ADD CONSTRAINT `topic_assignments_topic_id_fkey` FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `topic_assignments` ADD CONSTRAINT `topic_assignments_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_schedules` ADD CONSTRAINT `review_schedules_council_id_fkey` FOREIGN KEY (`council_id`) REFERENCES `councils`(`council_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_schedules` ADD CONSTRAINT `review_schedules_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_schedules` ADD CONSTRAINT `review_schedules_topicId_fkey` FOREIGN KEY (`topicId`) REFERENCES `topics`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `groups` ADD CONSTRAINT `groups_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMentor` ADD CONSTRAINT `GroupMentor_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupInvitation` ADD CONSTRAINT `GroupInvitation_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupInvitation` ADD CONSTRAINT `GroupInvitation_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `Student`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `progress_reports` ADD CONSTRAINT `progress_reports_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_verification_logs` ADD CONSTRAINT `ai_verification_logs_topic_id_fkey` FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `Student`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `semester_topic_major` ADD CONSTRAINT `semester_topic_major_topic_id_fkey` FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `semester_topic_major` ADD CONSTRAINT `semester_topic_major_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `decisions` ADD CONSTRAINT `decisions_semesterId_fkey` FOREIGN KEY (`semesterId`) REFERENCES `semesters`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_assignment` ADD CONSTRAINT `review_assignment_council_id_fkey` FOREIGN KEY (`council_id`) REFERENCES `councils`(`council_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review_assignment` ADD CONSTRAINT `review_assignment_topic_id_fkey` FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_topic_id_fkey` FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_council_id_fkey` FOREIGN KEY (`council_id`) REFERENCES `councils`(`council_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `council_members` ADD CONSTRAINT `council_members_council_id_fkey` FOREIGN KEY (`council_id`) REFERENCES `councils`(`council_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DefenseSchedule` ADD CONSTRAINT `DefenseSchedule_council_id_fkey` FOREIGN KEY (`council_id`) REFERENCES `councils`(`council_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DefenseSchedule` ADD CONSTRAINT `DefenseSchedule_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detail_major_topic` ADD CONSTRAINT `detail_major_topic_topic_id_fkey` FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submission_periods` ADD CONSTRAINT `submission_periods_semester_id_fkey` FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
