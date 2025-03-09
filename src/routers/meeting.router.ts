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
  checkRole(["mentor_main"]),
  validateCreateMeeting,
  meetingController.createMeeting.bind(meetingController)
);

// Cập nhật meeting
router.put(
  "/:id",
  authenticateToken,
  checkRole(["mentor_main"]),
  validateUpdateMeeting,
  meetingController.updateMeeting.bind(meetingController)
);

// Xóa meeting
router.delete(
  "/:id",
  authenticateToken,
  checkRole(["mentor_main"]),
  meetingController.deleteMeeting.bind(meetingController)
);

// Lấy danh sách meetings theo groupId hoặc groupCode
router.get(
  "/group/:groupId",
  authenticateToken,
  meetingController.getMeetingsByGroup.bind(meetingController)
);

// Lấy danh sách meetings của mentor đang đăng nhập (cả mentor chính và phụ)
router.get(
  "/mentor",
  authenticateToken,
  checkRole(["mentor_main", "mentor_sub"]),
  meetingController.getMeetingsByMentor.bind(meetingController)
);

// Lấy thông tin chi tiết của một meeting
router.get(
  "/:id",
  authenticateToken,
  meetingController.getMeetingById.bind(meetingController)
);

export default router; 