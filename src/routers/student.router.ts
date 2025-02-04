import express from "express";
import { StudentController } from "../controller/student.controller";

const router = express.Router();
const studentController = new StudentController();


router.get("/gets", studentController.getStudentList.bind(studentController));


router.put("/:studentId", studentController.updateStudentHandler.bind(studentController));

router.delete("/:studentId", studentController.deleteStudentHandler.bind(studentController));

router.get("/:semesterId", studentController.getStudentsBySemester.bind(studentController));

export default router;
