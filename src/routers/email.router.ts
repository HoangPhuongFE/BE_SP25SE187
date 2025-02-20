import { Router } from "express";
import { EmailController } from "../controller/email.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = Router();
const emailController = new EmailController();


router.post("/email/send",
   authenticateToken,
  checkRole(['admin', "graduation_thesis_manager", "examination_officer", "academic_officer"]),
   emailController.sendEmails);

export default router;
