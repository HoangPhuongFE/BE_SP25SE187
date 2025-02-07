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
  checkRole(["academic_officer"]),
  validateCreateTopic,
  topicController.createTopic.bind(topicController)
);

router.put(
  "/:id",
  authenticateToken,
  checkRole(["academic_officer"]),
  validateUpdateTopic,
  topicController.updateTopic.bind(topicController)
);

router.delete(
  "/:id",
  authenticateToken,
  checkRole(["academic_officer"]),
  topicController.deleteTopic.bind(topicController)
);

router.put(
  "/registration/:registrationId",
  authenticateToken,
  checkRole(["academic_officer"]),
  validateTopicRegistration,
  topicController.approveTopicRegistration.bind(topicController)
);

export default router; 