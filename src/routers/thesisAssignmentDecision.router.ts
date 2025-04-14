// 📁 src/routes/index.ts

import { Router } from "express";
import {
  createThesisAssignmentController,
  getAllThesisAssignmentsController,
  getThesisAssignmentByIdController,
  updateThesisAssignmentController,
  deleteThesisAssignmentController,
} from "../controllers/thesisAssignmentDecision.controller";
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const router = Router();

// Routes cho API giao/hướng dẫn khóa luận
router.post("/thesis-assignments",
  authenticateToken,
  checkRole(["examination_officer", "academic_officer", "graduation_thesis_manager"]),
   createThesisAssignmentController);

router.get("/thesis-assignments",
  authenticateToken,
  checkRole(["examination_officer", "academic_officer", "graduation_thesis_manager","lecturer"],false),
   getAllThesisAssignmentsController);

router.get("/thesis-assignments/:id",
  authenticateToken,
  checkRole(["examination_officer", "academic_officer", "graduation_thesis_manager","lecturer"],false),
   getThesisAssignmentByIdController);

router.put("/thesis-assignments/:id",
   authenticateToken,
  checkRole(["examination_officer", "academic_officer", "graduation_thesis_manager"]),
  updateThesisAssignmentController);

router.put("/thesis-assignments/:id/delete",
  authenticateToken,
  checkRole(["examination_officer", "academic_officer", "graduation_thesis_manager"]),
   deleteThesisAssignmentController);

export default router;