import { Router } from "express";
import { MeetingController } from "../controller/meeting.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";
import { validateCreateMeeting } from "../middleware/meeting.middleware";

const router = Router();
const meetingController = new MeetingController();

router.post(
  "/create",
  authenticateToken,
  checkRole(["mentor"]),
  validateCreateMeeting,
  meetingController.createMeeting.bind(meetingController)
);

router.put(
  "/:id",
  authenticateToken,
  checkRole(["mentor"]),
  meetingController.updateMeeting.bind(meetingController)
);

router.delete(
  "/:id",
  authenticateToken,
  checkRole(["mentor"]),
  meetingController.deleteMeeting.bind(meetingController)
);

router.get(
  "/group/:groupId",
  authenticateToken,
  meetingController.getMeetingsByGroup.bind(meetingController)
);

export default router; 