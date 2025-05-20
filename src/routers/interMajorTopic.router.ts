import { Router } from "express";
import { InterMajorTopicController } from "../controllers/interMajorTopic.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = Router();
const interMajorTopicController = new InterMajorTopicController();

// API tạo đề tài liên ngành
router.post(
  "/inter-major-topics",
  authenticateToken,
  checkRole(["lecturer", "academic_officer"]),
  interMajorTopicController.createInterMajorTopic.bind(interMajorTopicController)
);
router.post(
  '/inter-major-topics/with-mentors',
  authenticateToken,
  checkRole(['lecturer', 'academic_officer']), 
  interMajorTopicController.createInterMajorTopicWithMentors.bind(interMajorTopicController)
);
export default router;
