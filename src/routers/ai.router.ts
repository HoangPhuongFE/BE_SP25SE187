import { Router } from 'express';
import { AIController } from '../controller/ai.controller';
import { AIMiddleware } from '../middleware/ai.middleware';

const router = Router();
const aiController = new AIController();
const aiMiddleware = new AIMiddleware();

router.post('/validate-topic-name', aiMiddleware.validateTopicName, (req, res) =>
  aiController.validateTopicName(req, res)
);

export default router;