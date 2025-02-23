import express from 'express';
import { MajorController } from '../controller/major.controller';
import { authenticateToken } from '../middleware/user.middleware';

const router = express.Router();
const majorController = new MajorController();

// Route to get all majors
router.get('/', authenticateToken, majorController.getAllMajors);

export default router;
