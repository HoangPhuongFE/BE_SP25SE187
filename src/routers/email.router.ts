import { Router } from "express";
import { EmailTemplateController } from "../controller/emailTemplate.controller";
import { EmailController } from "../controller/email.controller";

const router = Router();
const emailTemplateController = new EmailTemplateController();
const emailController = new EmailController();

router.get("/email-templates", emailTemplateController.getAllTemplates);
router.get("/email-templates/:id/params", emailTemplateController.getTemplateParams);
router.post("/email/send", emailController.sendEmails);

export default router;
