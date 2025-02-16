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

router.put(
  "/:topicId",
  authenticateToken,
  checkRole(["academic_officer"]),
  validateUpdateTopic,
  topicController.updateTopic.bind(topicController)
);

router.delete(
  "/:topicId",
  authenticateToken,
  checkRole(["academic_officer"]),
  topicController.deleteTopic.bind(topicController)
);

// Routes cho mentor và leader (đăng ký đề xuất topic)
router.post(
  "/register",
  authenticateToken,
  checkRole(["mentor", "leader"]),
  validateTopicRegistration,
  topicController.registerTopic.bind(topicController)
);

router.put(
  "/register/:topicId",
  authenticateToken,
  checkRole(["mentor", "leader"]),
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

export default router; 