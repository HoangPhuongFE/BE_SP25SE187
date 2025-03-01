import { Router } from "express";
import { TopicReviewCouncilController } from "../controller/topicReviewCouncil.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";


const router = Router();
const topicReviewCouncilController = new TopicReviewCouncilController();


// Routes cho Graduation Thesis Manager (tạo hội đồng duyệt đề tài)
router.post(
  "/",
  authenticateToken,
  checkRole(["graduation_thesis_manager", "admin"]),
  topicReviewCouncilController.createReviewTopicCouncil.bind(topicReviewCouncilController)
);

// Route thêm thành viên vào hội đồng duyệt đề tài
router.post(
  "/:councilId/members",
  authenticateToken,
  checkRole(["graduation_thesis_manager", "admin"]),
  topicReviewCouncilController.addMembersToReviewCouncil.bind(topicReviewCouncilController)
);

// Route gán người đánh giá chính cho hội đồng duyệt đề tài
router.post(
  "/:councilId/primary-reviewer",
  authenticateToken,
  checkRole(["graduation_thesis_manager", "admin"]),
  topicReviewCouncilController.assignPrimaryReviewer.bind(topicReviewCouncilController)
);

// Route import kết quả đánh giá đề tài từ người đánh giá chính
router.post(
  "/:councilId/evaluations",
  authenticateToken,
  checkRole(["graduation_thesis_manager", "mentor", "admin"]),
  topicReviewCouncilController.importTopicEvaluations.bind(topicReviewCouncilController)
);

// Route lấy danh sách hội đồng duyệt đề tài
router.get(
  "/",
  authenticateToken,
  checkRole(["graduation_thesis_manager", "mentor", "admin"]),
  topicReviewCouncilController.getReviewCouncils.bind(topicReviewCouncilController)
);

// Route lấy chi tiết hội đồng duyệt đề tài
router.get(
  "/:councilId",
  authenticateToken,
  checkRole(["graduation_thesis_manager", "mentor", "admin"]),
  topicReviewCouncilController.getReviewCouncilDetail.bind(topicReviewCouncilController)
);

export default router; 