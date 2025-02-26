import { Router } from "express";
import { TopicController } from "../controller/topic.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";
import { validateCreateTopic, validateUpdateTopic, validateTopicRegistration, validateCreateCouncil } from '../middleware/topic.middleware';

const router = Router();
const topicController = new TopicController();

// Routes cho academic officer (tạo đề tài chính thức - auto approved)
router.post(
  "/",
  authenticateToken,
  checkRole(["academic_officer"]),
  validateCreateTopic,
  topicController.createTopic.bind(topicController)
);

// Route cập nhật topic
router.put(
  "/:topicId",
  authenticateToken,
  checkRole(["academic_officer"]),
  validateUpdateTopic,
  topicController.updateTopic.bind(topicController)
);

// Route xóa topic
router.delete(
  "/:topicId",
  authenticateToken,
  checkRole(["academic_officer"]),
  topicController.deleteTopic.bind(topicController)
);

// Route xóa topic đăng ký của mentor
router.delete(
  "/register/:topicId",
  authenticateToken,
  checkRole(["mentor"]),
  topicController.deleteTopic.bind(topicController)
);

// Routes cho mentor (đăng ký đề xuất topic)
router.post(
  "/register",
  authenticateToken,
  checkRole(["mentor"]),
  validateTopicRegistration,
  topicController.registerTopic.bind(topicController)
);

// Route cập nhật topic
router.put(
  "/register/:topicId",
  authenticateToken,
  checkRole(["mentor"]),
  validateUpdateTopic,
  topicController.updateTopic.bind(topicController)
);

// Routes cho Graduation Thesis Manager (tạo hội đồng duyệt đề tài)
router.post(
  "/registration/:registrationId/council",
  authenticateToken,
  checkRole(["thesis_manager"]),
  validateCreateCouncil,
  topicController.createTopicReviewCouncil.bind(topicController)
);

// Route lấy danh sách topic (cho tất cả user đã đăng nhập)
router.get(
  "/",
  authenticateToken,
  topicController.getAllTopics.bind(topicController)
);

// Route duyệt đề tài
router.put(
  "/registration/:registrationId/approve",
  authenticateToken,
  checkRole(["mentor"]),
  topicController.approveTopicRegistration.bind(topicController)
);

// Route lấy chi tiết topic
router.get(
  "/:id",
  authenticateToken,
  topicController.getTopicDetail.bind(topicController)
);

// Route export topic
router.get(
  "/export/excel",
  authenticateToken,
  checkRole(["academic_officer"]),
  topicController.exportTopics.bind(topicController)
);

// Route import điểm đánh giá đề tài
router.post(
  "/import/evaluations",
  authenticateToken,
  checkRole(["academic_officer"]),
  topicController.importTopicEvaluations.bind(topicController)
);

// Route gán đề tài cho nhóm
router.post(
  "/assign-to-group",
  authenticateToken,
  checkRole(["mentor"]),
  topicController.assignTopicToGroup.bind(topicController)
);

export default router; 