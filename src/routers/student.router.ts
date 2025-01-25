import express from 'express';
import { getStudentList, updateStudentHandler, deleteStudentHandler,getStudentsBySemester } from '../controller/student.controller';

const router = express.Router();

router.get('/gets', getStudentList);
router.put('/:studentId', updateStudentHandler);
router.delete('/:studentId', deleteStudentHandler); 
router.get("/:semesterId", getStudentsBySemester);

export default router;
