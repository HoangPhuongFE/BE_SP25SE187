import express from "express";
import { StudentController } from "../controllers/student.controller";
import { checkRole, authenticateToken } from "../middleware/user.middleware";


const router = express.Router();
const studentController = new StudentController();




router.put("/:studentId",checkRole(["graduation_thesis_manager", "examination_officer"]), studentController.updateStudentHandler.bind(studentController));


router.get("/:semesterId", studentController.getStudentsBySemester.bind(studentController));



export default router;
