import express from "express";
import { ExportController } from "../controller/export.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = express.Router();
const exportController = new ExportController();

router.get(
  "/export-students/:semesterId",
  authenticateToken,
  checkRole(["admin", "head_of_department"]),
  // Bind method
  exportController.exportStudentList.bind(exportController)
);

router.get(
  "/export-conditions/:semesterId",
  authenticateToken,
  checkRole(["admin", "head_of_department"]),
  exportController.exportConditionList.bind(exportController)
);

export default router;
