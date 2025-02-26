import { Router } from "express";
import { TopicController } from "../controller/topic.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";
import { validateCreateTopic, validateUpdateTopic, validateTopicRegistration, validateCreateCouncil } from '../middleware/topic.middleware';
import multer from 'multer';

const router = Router();
const topicController = new TopicController();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/topics');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Routes cho academic officer (tạo đề tài chính thức - auto approved)
router.post(
  "/",
  authenticateToken,
  checkRole(["academic_officer"]),
  upload.array('documents'),
  validateCreateTopic,
  topicController.createTopic.bind(topicController)
);

router.put(
  "/:topicId",
  authenticateToken,
  checkRole(["academic_officer", "mentor"]),
  validateUpdateTopic,
  topicController.updateTopic.bind(topicController)
);

router.delete(
  "/:topicId",
  authenticateToken,
  checkRole(["academic_officer"]),
  topicController.deleteTopic.bind(topicController)
);

// Routes cho mentor (đăng ký đề xuất topic)
router.post(
  "/register",
  authenticateToken,
  checkRole(["mentor"]),
  upload.array('documents'),
  validateTopicRegistration,
  topicController.registerTopic.bind(topicController)
);

router.put(
  "/register/:topicId",
  authenticateToken,
  checkRole(["mentor"]),
  upload.array('documents'),
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

router.get(
  "/export/excel",
  authenticateToken,
  checkRole(["academic_officer"]),
  topicController.exportTopics.bind(topicController)
);

router.post(
  "/import/evaluations",
  authenticateToken,
  checkRole(["academic_officer"]),
  upload.single('file'),
  topicController.importTopicEvaluations.bind(topicController)
);

router.post(
  "/assign-to-group",
  authenticateToken,
  checkRole(["mentor"]),
  topicController.assignTopicToGroup.bind(topicController)
);

export default router; 