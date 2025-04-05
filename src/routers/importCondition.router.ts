import express from "express";
import multer from "multer";
import { authenticateToken, checkRole } from "../middleware/user.middleware";
import { ImportConditionController } from "../controllers/importCondition.controller";

const upload = multer({ dest: "uploads/" });
const router = express.Router();

const importConditionController = new ImportConditionController();

router.post(
  "/import-conditions",
  authenticateToken,
  checkRole(["admin", "academic_officer"]),
  upload.single("file"),
  importConditionController.importConditionListHandler.bind(importConditionController)
);

export default router;
