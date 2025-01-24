import express from 'express';
import { getStudentList, updateStudentHandler, deleteStudentHandler } from '../controller/student.controller';

const router = express.Router();

router.get('/gets', getStudentList);
router.put('/:studentId', updateStudentHandler);
router.delete('/:studentId', deleteStudentHandler); 

export default router;
