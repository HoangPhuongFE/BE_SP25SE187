import { Router } from "express";
import { TopicController } from "../controller/topic.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = Router();
const topicController = new TopicController();

// 1. API: Tạo đề tài (Chỉ Academic có quyền)
router.post(
  "/",
  authenticateToken,
  checkRole(["academic_officer", "admin", "mentor", "graduation_thesis_manager"]),
  topicController.createTopic.bind(topicController)
);

// 2. Lấy danh sách đề tài theo học kỳ
router.get(
  "/semester/:semesterId",
  authenticateToken,
  topicController.getTopicsBySemester.bind(topicController)
);

// 3. Lấy danh sách đề tài có thể đăng ký
router.get(
  "/available-topics",
  authenticateToken,
  topicController.getAvailableTopics.bind(topicController)
);

// 4. Nhóm trưởng đăng ký đề tài
router.post(
  "/topic-registrations",
  authenticateToken,
  checkRole(["leader", "student"]),
  topicController.registerTopic.bind(topicController)
);

// 5. Mentor duyệt nhóm đăng ký đề tài
router.put(
  "/topic-registrations/approve",
  authenticateToken,
  checkRole(["mentor"]),
  topicController.approveTopicRegistration.bind(topicController)
);

// 6. Route duyệt đề tài (approval) dành cho hội đồng
router.get(
  "/approval",
  authenticateToken,
  checkRole(["admin", "review", "lecturer", "graduation_thesis_manager", "academic_officer"]),
  topicController.getTopicsForApprovalBySubmission.bind(topicController)
);
// --------------------- Các route động ---------------------

// 7. Cập nhật đề tài theo topicId
router.put(
  "/:topicId",
  authenticateToken,
  checkRole(["mentor", "academic_officer", "admin", "graduation_thesis_manager", "lecturer"]),
  topicController.updateTopic.bind(topicController)
);

// 8. Lấy chi tiết đề tài theo topicId
router.get(
  "/:topicId",
  authenticateToken,
  topicController.getTopicById.bind(topicController)
);

// 9. Xóa đề tài theo topicId
router.delete(
  "/:topicId",
  authenticateToken,
  checkRole(["admin", "graduation_thesis_manager"]),
  topicController.deleteTopic.bind(topicController)
);

// 10. Hội đồng xét duyệt cập nhật trạng thái đề tài
router.put(
  "/:topicId/status",
  authenticateToken,
  checkRole(["admin", "academic_officer", "reivewer", "lecturer","mentor"]),
  topicController.updateTopicStatus.bind(topicController)
);

export default router;
