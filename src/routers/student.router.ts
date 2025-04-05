import express from "express";
import { StudentController } from "../controllers/student.controller";
import { checkRole, authenticateToken } from "../middleware/user.middleware";


const router = express.Router();
const studentController = new StudentController();


router.get("/gets", studentController.getStudentList.bind(studentController));


router.put("/:studentId", studentController.updateStudentHandler.bind(studentController));

router.delete("/delete/:studentId", authenticateToken,
    checkRole(['admin', "graduation_thesis_manager", "examination_officer"]), studentController.deleteStudentHandler.bind(studentController));

router.get("/:semesterId", studentController.getStudentsBySemester.bind(studentController));

router.delete("/semester/:semesterId", authenticateToken,
    checkRole(['admin', "graduation_thesis_manager", "examination_officer"]), studentController.deleteAllStudentsBySemesterHandler.bind(studentController));


export default router;
