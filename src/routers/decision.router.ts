import express from "express";
import {
  createDecisionController,
  deleteDecisionController,
  getAllDecisionsController,
  getDecisionByIdController,
  updateDecisionController,
} from "../controllers/decision.controller";
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const router = express.Router();

router.post("/decisions",
  authenticateToken,
  checkRole(["examination_officer", "academic_officer", "graduation_thesis_manager"]),
  createDecisionController);

router.get("/decisions",
  authenticateToken,
  checkRole(["examination_officer", "academic_officer", "graduation_thesis_manager","lecturer"],false),
  getAllDecisionsController);


router.get("/decisions/:id",
  authenticateToken,
  checkRole(["examination_officer", "academic_officer", "graduation_thesis_manager","lecturer"]),
  getDecisionByIdController);

router.put("/decisions/:id",
  authenticateToken,
  checkRole(["examination_officer", "academic_officer", "graduation_thesis_manager"]),
  updateDecisionController);

router.put("/decisions/:id/delete",
  authenticateToken,
  checkRole(["examination_officer", "academic_officer", "graduation_thesis_manager"]),
  deleteDecisionController);

export default router;
