import { Router } from "express";
import { EmailController } from "../controller/email.controller";

const router = Router();
const emailController = new EmailController();

router.post("/send-semester-results", emailController.sendSemesterResults);

export default router;