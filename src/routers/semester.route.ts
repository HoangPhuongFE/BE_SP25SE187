import express from "express";
import { getSemestersByYear, createSemester, updateSemester, deleteSemester } from "../controller/semester.controller";

const router = express.Router();

router.get("/:yearId", getSemestersByYear);
router.post("/", createSemester);
router.put("/:id", updateSemester);
router.delete("/:id", deleteSemester);

export default router;
