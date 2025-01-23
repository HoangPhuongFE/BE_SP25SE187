import express from 'express';
import { getStudentList } from '../controller/student.controller';

const router = express.Router();

router.get('/gets', getStudentList);

export default router;
