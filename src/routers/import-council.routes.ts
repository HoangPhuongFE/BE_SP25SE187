import { Router } from "express";
import { ImportCouncilController } from "../controller/import-council.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";
import multer from "multer";

const upload = multer({ dest: "uploads/" });

const router = Router();
const importCouncilController = new ImportCouncilController();

router.post(
  "/import",
  authenticateToken,
  checkRole(["admin", "graduation_thesis_manager", "academic_officer"]),
  upload.single("file"), 
  (req, res) => importCouncilController.importCouncils(req, res)
);

export default router;
