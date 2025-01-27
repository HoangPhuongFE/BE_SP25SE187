import express from 'express';
import multer from 'multer';
import { importConditionListHandler } from '../controller/importCondition.controller';
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const upload = multer({ dest: 'uploads/' });
const router = express.Router();

router.post(
  '/import-conditions',
  authenticateToken,
  checkRole(['admin', 'head_of_department']),
  upload.single('file'),
  importConditionListHandler
);

export default router;
