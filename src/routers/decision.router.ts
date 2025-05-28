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
  checkRole([ "academic_officer"]),
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
  checkRole([ "academic_officer"]),
  updateDecisionController);

router.put("/decisions/:id/delete",
  authenticateToken,
  checkRole([ "academic_officer"]),
  deleteDecisionController);

export default router;
