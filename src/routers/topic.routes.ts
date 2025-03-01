import { Router } from "express";
import { TopicController } from "../controller/topic.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = Router();
const topicController = new TopicController();

// 1️ API: Tạo đề tài (Chỉ Academic có quyền)
router.post(
  "/",
  authenticateToken,
  checkRole(["academic_officer", "admin","mentor","graduation_thesis_manager"]),
  topicController.createTopic.bind(topicController)
);


router.put(
  "/:topicId",
  authenticateToken,
  checkRole(["mentor", "academic_officer", "admin", "graduation_thesis_manager"]),
  topicController.updateTopic.bind(topicController)
);
// Lấy danh sách đề tài theo học kỳ
router.get(
  "/semester/:semesterId",
  authenticateToken,
  topicController.getTopicsBySemester.bind(topicController)
);

// Lấy chi tiết đề tài theo topicId
router.get(
  "/:topicId",
  authenticateToken,
  topicController.getTopicById.bind(topicController)
);

export default router;
