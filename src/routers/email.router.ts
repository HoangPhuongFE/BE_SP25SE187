import { Router } from "express";
import { EmailController } from "../controller/email.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = Router();
const emailController = new EmailController();

router.post(
  "/send",
  authenticateToken,
  checkRole(["admin", "graduation_thesis_manager"]),
  (req, res) => emailController.sendEmails(req, res)
);

router.post(
  "/send-bulk",
  authenticateToken,
  checkRole(["admin", "graduation_thesis_manager"]),
  (req, res) => emailController.sendBulkEmails(req, res)
);

export default router;
