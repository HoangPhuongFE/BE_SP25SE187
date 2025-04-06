import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { AIMiddleware } from '../middleware/ai.middleware';
import {authenticateToken, checkRole  } from '../middleware/user.middleware';
const router = Router();
const aiController = new AIController();
const aiMiddleware = new AIMiddleware();

router.post('/validate-topic-name',authenticateToken, aiMiddleware.validateTopicName, (req, res) =>
  aiController.validateTopicName(req, res)
);

router.post('/batch-verify-decision', authenticateToken, (req, res) =>
  aiController.batchVerifyDecision(req, res)
);

export default router;