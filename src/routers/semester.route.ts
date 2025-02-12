import express from "express";
import { SemesterController } from "../controller/semester.controller";

const router = express.Router();
const semesterController = new SemesterController();

router.get("/all", semesterController.getAllSemesters.bind(semesterController));

router.get("/detail/:id", semesterController.getSemesterById.bind(semesterController));

router.get("/:yearId", semesterController.getSemestersByYear.bind(semesterController));

router.post("/", semesterController.createSemester.bind(semesterController));

router.put("/:id", semesterController.updateSemester.bind(semesterController));

router.delete("/:id", semesterController.deleteSemester.bind(semesterController));


export default router;
