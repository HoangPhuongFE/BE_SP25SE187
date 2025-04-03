-- AlterTable
ALTER TABLE `decisions` MODIFY `based_on_json` TEXT NULL,
    MODIFY `clauses_json` TEXT NULL,
    MODIFY `participants_json` TEXT NULL;
