import express from "express";
import { ExportController } from "../controllers/export.conditions.students.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = express.Router();
const exportController = new ExportController();

router.get(
  "/export-students/:semesterId",
  authenticateToken,
  checkRole(["graduation_thesis_manager", "academic_officer", "examination_officer"]),
  // Bind method
  exportController.exportStudentList.bind(exportController)
);

router.get(
  "/export-conditions/:semesterId",
  authenticateToken,
  checkRole(["graduation_thesis_manager", "academic_officer", "examination_officer"]),
  exportController.exportConditionList.bind(exportController)
);

export default router;
