import { Router } from "express";
import { ProgressReportController } from "../controller/progress-report.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";
import { 
  validateCreateProgressReport, 
  validateUpdateProgressReport,
  validateMentorFeedback,
  validateCreateReportPeriod
} from "../middleware/progress-report.middleware";

const router = Router();
const progressReportController = new ProgressReportController();

// Tạo báo cáo tiến độ mới
router.post(
  "/create",
  authenticateToken,
  checkRole(["student", "leader"]),
  validateCreateProgressReport,
  progressReportController.createProgressReport.bind(progressReportController)
);

// Mentor chính tạo khoảng thời gian báo cáo
router.post(
  "/period",
  authenticateToken,
  checkRole(["lecturer"]),
  validateCreateReportPeriod,
  progressReportController.createReportPeriod.bind(progressReportController)
);

// Lấy danh sách khoảng thời gian báo cáo của nhóm
router.get(
  "/periods/:groupId",
  authenticateToken,
  checkRole(["lecturer", "student", "leader"]),
  progressReportController.getReportPeriods.bind(progressReportController)
);

// Mentor thêm phản hồi cho báo cáo
router.post(
  "/:id/feedback",
  authenticateToken,
  checkRole(["lecturer"]),
  validateMentorFeedback,
  progressReportController.addMentorFeedback.bind(progressReportController)
);

// Đánh dấu báo cáo đã đọc
router.post(
  "/:id/mark-read",
  authenticateToken,
  checkRole(["lecturer"]),
  progressReportController.markReportAsRead.bind(progressReportController)
);

// Cập nhật báo cáo tiến độ
router.put(
  "/:id",
  authenticateToken,
  checkRole(["student", "leader"]),
  validateUpdateProgressReport,
  progressReportController.updateProgressReport.bind(progressReportController)
);

// Xóa báo cáo tiến độ
router.delete(
  "/:id",
  authenticateToken,
  checkRole(["lecturer", "student"]),
  progressReportController.deleteProgressReport.bind(progressReportController)
);

// Lấy danh sách báo cáo tiến độ của sinh viên hiện tại
router.get(
  "/my-reports",
  authenticateToken,
  checkRole(["student", "leader"]),
  progressReportController.getMyProgressReports.bind(progressReportController)
);

// Lấy danh sách báo cáo tiến độ theo groupId
router.get(
  "/group/:groupId",
  authenticateToken,
  checkRole(["lecturer"]),
  progressReportController.getProgressReportsByGroup.bind(progressReportController)
);

// Lấy danh sách báo cáo tiến độ theo mentor
router.get(
  "/mentor",
  authenticateToken,
  checkRole(["lecturer"]),
  progressReportController.getProgressReportsByMentor.bind(progressReportController)
);

// Lấy báo cáo tiến độ theo tuần và nhóm
router.get(
  "/group/:groupId/week/:weekNumber",
  authenticateToken,
  checkRole(["student", "leader"]),
  progressReportController.getProgressReportByWeek.bind(progressReportController)
);

// Lấy thông tin chi tiết của một báo cáo tiến độ
router.get(
  "/:id",
  authenticateToken,
  checkRole(["student", "leader", "lecturer"]),
  progressReportController.getProgressReportById.bind(progressReportController)
);

export default router; 