import express from "express";
import { exportStudentList, exportConditionList } from "../controller/export.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = express.Router();

router.get(
  "/export-students/:semesterId",
  authenticateToken,
  checkRole(["admin", "head_of_department"]),
  exportStudentList
);

router.get(
  "/export-conditions/:semesterId",
  authenticateToken,
  checkRole(["admin", "head_of_department"]),
  exportConditionList
);

export default router;
