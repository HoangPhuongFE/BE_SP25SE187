import { Router } from "express";
import { EmailController } from "../controller/email.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = Router();
const emailController = new EmailController();

router.post(
  "/send",
  authenticateToken,
  checkRole(["academic_officer", "graduation_thesis_manager"]),
  (req, res) => emailController.sendEmails(req, res)
);

router.post(
  "/send-bulk",
  authenticateToken,
  checkRole(["academic_officer", "graduation_thesis_manager"]),
  (req, res) => emailController.sendBulkEmails(req, res)
);

router.post("/send-custom",
  authenticateToken,
  checkRole(["academic_officer", "graduation_thesis_manager"]),
  (_req, _res) =>  emailController.sendCustomEmail(_req, _res)
);
export default router;
