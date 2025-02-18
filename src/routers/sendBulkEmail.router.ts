import { Router } from "express";
import { EmailController } from "../controller/sendBulkEmail.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = Router();
const emailController = new EmailController();

// Gửi email thông báo sinh viên đủ/không đủ điều kiện
router.post(
  "/send-qualification-emails",
  authenticateToken,
  checkRole(["admin", "academic_officer"]),
  emailController.sendQualificationEmails.bind(emailController)
);

// Gửi email thông báo lập nhóm
router.post(
  "/send-group-formation-emails",
  authenticateToken,
  checkRole(["admin", "academic_officer"]),
  emailController.sendGroupFormationEmails.bind(emailController)
);

export default router;
