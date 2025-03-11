import { Router } from "express";
import { ProgressReportController } from "../controller/progress-report.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";
import { 
  validateCreateProgressReport, 
  validateUpdateProgressReport,
  validateMentorFeedback 
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

// Mentor thêm phản hồi cho báo cáo
router.post(
  "/:id/feedback",
  authenticateToken,
  checkRole(["mentor_main", "mentor_sub"]),
  validateMentorFeedback,
  progressReportController.addMentorFeedback.bind(progressReportController)
);

// Đánh dấu báo cáo đã đọc
router.post(
  "/:id/mark-read",
  authenticateToken,
  checkRole(["student", "leader"]),
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
  checkRole(["student", "leader"]),
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
  checkRole(["student", "leader"]),
  progressReportController.getProgressReportsByGroup.bind(progressReportController)
);

// Lấy danh sách báo cáo tiến độ theo mentor
router.get(
  "/mentor",
  authenticateToken,
  checkRole(["mentor_main", "mentor_sub"]),
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
  checkRole(["student", "leader"]),
  progressReportController.getProgressReportById.bind(progressReportController)
);

export default router; 