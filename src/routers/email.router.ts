import { Router } from "express";
import { EmailController } from "../controllers/email.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";
import { wrapAsync } from "../utils/handler";

const controller = new EmailController();
const router = Router();
const roles = ["admin", "graduation_thesis_manager", "examination_officer", "academic_officer"];

router.post(
  "/group-formation-notification",
  authenticateToken,
  checkRole(roles),
  wrapAsync(controller.sendGroupFormationNotification)
);
router.post(
  "/topic-decision-announcement",
  authenticateToken,
  checkRole(roles),
  wrapAsync(controller.sendTopicDecisionAnnouncement)
);
router.post(
  "/review-schedule-notification",
  authenticateToken,
  checkRole(roles),
  wrapAsync(controller.sendReviewScheduleNotification)
);
router.post(
  "/invite-lecturers-topic-registration",
  authenticateToken,
  checkRole(roles),
  wrapAsync(controller.sendInviteLecturersTopicRegistration)
);
router.post(
  "/approved-topics-notification",
  authenticateToken,
  checkRole(roles),
  wrapAsync(controller.sendApprovedTopicsNotification)
);
router.post(
  "/defense-schedule-notification",
  authenticateToken,
  checkRole(roles),
  wrapAsync(controller.sendDefenseScheduleNotification)
);

router.post(
  "/  ",
  authenticateToken,
  checkRole(roles),
  wrapAsync(controller.sendThesisEligibilityNotifications.bind(controller))
);

export default router;