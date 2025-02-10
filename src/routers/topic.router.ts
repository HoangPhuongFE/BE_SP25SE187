import { Router } from "express";
import { TopicController } from "../controller/topic.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";
import { validateCreateTopic, validateUpdateTopic, validateTopicRegistration } from '../middleware/topic.middleware';

const router = Router();
const topicController = new TopicController();

// Routes cho academic officer
router.post(
  "/",
  authenticateToken,
  checkRole(["academic_officer", "mentor", "leader"]),
  validateCreateTopic,
  topicController.createTopic.bind(topicController)
);

router.put(
  "/:id",
  authenticateToken,
  checkRole(["academic_officer", "mentor", "leader"]),
  validateUpdateTopic,
  topicController.updateTopic.bind(topicController)
);

router.delete(
  "/:id",
  authenticateToken,
  checkRole(["academic_officer", "mentor"]),
  topicController.deleteTopic.bind(topicController)
);

router.put(
  "/registration/:registrationId",
  authenticateToken,
  checkRole(["academic_officer", "mentor"]),
  validateTopicRegistration,
  topicController.approveTopicRegistration.bind(topicController)
);

router.get(
  "/",
  authenticateToken,
  topicController.getAllTopics.bind(topicController)
);

export default router; 