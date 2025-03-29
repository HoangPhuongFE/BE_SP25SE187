import { Router } from 'express';
import { AIController } from '../controller/ai.controller';
import { AIMiddleware } from '../middleware/ai.middleware';
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const router = Router();
const aiController = new AIController();
const aiMiddleware = new AIMiddleware();

// Route train model AI
router.post(
  '/train-model',
  (req, res) => aiController.trainModel(req, res)
);

// Route kiểm tra mã đề tài
router.post(
  '/validate-topic-code',
  aiMiddleware.validateTopicCode,
  (req, res) => aiController.validateTopicCode(req, res)
);

// Route kiểm tra tên đề tài
router.post(
  '/validate-topic-name',
  aiMiddleware.validateTopicName,
  (req, res) => aiController.validateTopicName(req, res)
);

// Route kiểm tra mã nhóm
router.post(
  '/validate-group-code',
  aiMiddleware.validateGroupCode,
  (req, res) => aiController.validateGroupCode(req, res)
);

// Route kiểm tra toàn bộ thông tin đề tài
router.post(
  '/validate-topic',
  aiMiddleware.validateTopic,
  (req, res) => aiController.validateTopic(req, res)
);

// Route kiểm tra quyết định phân công đề tài của Examination Officer
router.post(
  '/verify-assignment',
  authenticateToken,
  checkRole(['examination_officer']),
  aiMiddleware.validateAssignmentVerification,
  (req, res) => aiController.verifyAssignmentDecision(req, res)
);

// Route chuyển đổi loại AI
router.post(
  '/switch-ai-provider',
  (req, res) => aiController.switchAIProvider(req, res)
);

// Route lấy thông tin cấu hình AI
router.get(
  '/ai-config',
  (req, res) => aiController.getAIConfig(req, res)
);

export default router; 