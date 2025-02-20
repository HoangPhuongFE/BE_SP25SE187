import { Router } from "express";
import { EmailTemplateController } from "../controller/emailTemplate.controller";

const router = Router();
const emailTemplateController = new EmailTemplateController();

router.get("/templates", emailTemplateController.getAllTemplates);

router.get("/templates/:id", emailTemplateController.getTemplateById);

router.get("/templates/:id/params", emailTemplateController.getTemplateParams);

router.post("/templates", emailTemplateController.createTemplate);

router.put("/templates/:id", emailTemplateController.updateTemplate);

router.delete("/templates/:id", emailTemplateController.deleteTemplate);

export default router;
