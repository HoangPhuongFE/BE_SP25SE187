import { Router } from 'express';
import { AIController } from '../controller/ai.controller';
import { AIMiddleware } from '../middleware/ai.middleware';

const router = Router();
const aiController = new AIController();
const aiMiddleware = new AIMiddleware();

// Route kiểm tra mã đề tài
router.post(
  '/validate-topic-code',
  aiMiddleware.validateTopicCode,
  aiController.validateTopicCode
);

// Route kiểm tra tên đề tài
router.post(
  '/validate-topic-name',
  aiMiddleware.validateTopicName,
  aiController.validateTopicName
);

// Route kiểm tra mã nhóm
router.post(
  '/validate-group-code',
  aiMiddleware.validateGroupCode,
  aiController.validateGroupCode
);

// Route kiểm tra toàn bộ thông tin đề tài
router.post(
  '/validate-topic',
  aiMiddleware.validateTopic,
  aiController.validateTopic
);

export default router; 