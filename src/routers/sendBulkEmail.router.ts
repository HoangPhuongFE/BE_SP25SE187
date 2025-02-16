import { Router } from "express";
import {  checkRole, authenticateToken} from "../middleware/user.middleware";
import { EmailController } from "../controller/sendBulkEmail.controller";

const router = Router();
const emailController = new EmailController();

router.post(
  "/send-emails",
    authenticateToken,
  checkRole(["admin", "academic_officer"]),
  emailController.sendEmailsByType.bind(emailController)
);

export default router;
