import express from "express";
import { SemesterController } from "../controllers/semester.controller";
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const router = express.Router();
const semesterController = new SemesterController();

router.get("/all",authenticateToken,  semesterController.getAllSemesters.bind(semesterController));

router.get("/detail/:id", authenticateToken, semesterController.getSemesterById.bind(semesterController));

router.get("/:yearId", authenticateToken, semesterController.getSemestersByYear.bind(semesterController));

router.post("/", authenticateToken, semesterController.createSemester.bind(semesterController));

router.put("/:id",authenticateToken,  semesterController.updateSemester.bind(semesterController));

router.put("/:id/delete", authenticateToken, semesterController.deleteSemester.bind(semesterController));


export default router;
