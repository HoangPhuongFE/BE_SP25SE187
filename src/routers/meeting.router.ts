import { Router } from "express";
import { MeetingController } from "../controller/meeting.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";
import { validateCreateMeeting, validateUpdateMeeting } from "../middleware/meeting.middleware";

const router = Router();
const meetingController = new MeetingController();

// Tạo meeting mới
router.post(
  "/create",
  authenticateToken,
  checkRole(["lecturer"]),
  validateCreateMeeting,
  meetingController.createMeeting.bind(meetingController)
);

// Cập nhật meeting
router.put(
  "/:id",
  authenticateToken,
  checkRole(["lecturer"]),
  validateUpdateMeeting,
  meetingController.updateMeeting.bind(meetingController)
);

// Xóa meeting
router.delete(
  "/:id",
  authenticateToken,
  checkRole(["lecturer"]),
  meetingController.deleteMeeting.bind(meetingController)
);

// Lấy danh sách meetings theo groupId hoặc groupCode
router.get(
  "/group/:groupId",
  authenticateToken,
  meetingController.getMeetingsByGroup.bind(meetingController)
);

// Lấy meetings của lecturer với vai trò mentor chính
router.get(
  "/lecturer/main",
  authenticateToken,
  checkRole(["lecturer"]),
  meetingController.getMainMentorMeetings.bind(meetingController)
);

// Lấy meetings của lecturer với vai trò mentor phụ
router.get(
  "/lecturer/sub",
  authenticateToken,
  checkRole(["lecturer"]),
  meetingController.getSubMentorMeetings.bind(meetingController)
);

// Lấy thông tin chi tiết của một meeting
router.get(
  "/:id",
  authenticateToken,
  meetingController.getMeetingById.bind(meetingController)
);

export default router; 