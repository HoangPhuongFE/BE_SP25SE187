import { Router } from "express";
import {  checkRole, authenticateToken} from "../middleware/user.middleware";
import { EmailController } from "../controller/email.controller";

const router = Router();
const emailController = new EmailController();

router.post(
  "/send-emails",
    authenticateToken,
  checkRole(["admin"]),
  emailController.sendEmailsByQualification
);

export default router;
