import { Router } from "express";
import { TopicController } from "../controller/topic.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";
import { validateCreateTopic, validateUpdateTopic, validateTopicRegistration, validateCreateCouncil } from '../middleware/topic.middleware';
import { PrismaClient } from '@prisma/client';

const router = Router();
const topicController = new TopicController();
const prisma = new PrismaClient();


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
  "/review-councils",
  authenticateToken,
  checkRole(["graduation_thesis_manager", "admin"]),
  topicController.createReviewTopicCouncil.bind(topicController)
);

// Route thêm thành viên vào hội đồng duyệt đề tài
router.post(
  "/review-councils/:councilId/members",
  authenticateToken,
  checkRole(["graduation_thesis_manager", "admin"]),
  topicController.addMembersToReviewCouncil.bind(topicController)
);

// Route gán người đánh giá chính cho hội đồng duyệt đề tài
router.post(
  "/review-councils/:councilId/primary-reviewer",
  authenticateToken,
  checkRole(["graduation_thesis_manager", "admin"]),
  topicController.assignPrimaryReviewer.bind(topicController)
);

// Route import kết quả đánh giá đề tài từ người đánh giá chính
router.post(
  "/review-councils/:councilId/evaluations",
  authenticateToken,
  checkRole(["graduation_thesis_manager", "mentor", "admin"]),
  topicController.importTopicEvaluations.bind(topicController)
);

// Route lấy danh sách hội đồng duyệt đề tài
router.get(
  "/review-councils",
  authenticateToken,
  checkRole(["graduation_thesis_manager", "mentor", "admin"]),
  topicController.getReviewCouncils.bind(topicController)
);

// Route lấy chi tiết hội đồng duyệt đề tài
router.get(
  "/review-councils/:councilId",
  authenticateToken,
  checkRole(["graduation_thesis_manager", "mentor", "admin"]),
  topicController.getReviewCouncilDetail.bind(topicController)
);

// Route lấy danh sách tất cả đề tài (cho tất cả user đã đăng nhập)
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

// Route lấy chi tiết đề tài chính thức
router.get(
  "/official/:id",
  authenticateToken,
  topicController.getOfficialTopicDetail.bind(topicController)
);

// Route lấy chi tiết đề xuất đề tài
router.get(
  "/proposed/:id",
  authenticateToken,
  topicController.getProposedTopicDetail.bind(topicController)
);

// Route export topic
router.get(
  "/export/excel",
  authenticateToken,
  checkRole(["academic_officer"]),
  topicController.exportTopics.bind(topicController)
);

// Route gán đề tài cho nhóm
router.post(
  "/assign-to-group",
  authenticateToken,
  checkRole(["mentor"]),
  topicController.assignTopicToGroup.bind(topicController)
);

// Route lấy danh sách đề tài có thể chọn (đã được phê duyệt và chưa được gán cho nhóm nào)
router.get(
  "/available/topics",
  authenticateToken,
  checkRole(["student", "leader", "mentor", "admin"]),
  topicController.getAvailableTopics.bind(topicController)
);

// Route cho phép nhóm chọn một đề tài đã được phê duyệt
router.post(
  "/select-for-group",
  authenticateToken,
  checkRole(["student", "leader"]),
  topicController.selectTopicForGroup.bind(topicController)
);

export default router; 