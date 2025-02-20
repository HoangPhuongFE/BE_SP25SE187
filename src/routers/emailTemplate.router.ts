import { Router } from "express";
import { EmailTemplateController } from "../controller/emailTemplate.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = Router();
const emailTemplateController = new EmailTemplateController();

router.get("/templates",
    authenticateToken,
    checkRole(['admin', "graduation_thesis_manager", "examination_officer", "academic_officer"]),
 emailTemplateController.getAllTemplates);

router.get("/templates/:id",
    authenticateToken,
    checkRole(['admin', "graduation_thesis_manager", "examination_officer", "academic_officer",]), 
    emailTemplateController.getTemplateById);

router.get("/templates/:id/params"
    ,authenticateToken,
    checkRole(['admin', "graduation_thesis_manager", "examination_officer", "academic_officer",]),
     emailTemplateController.getTemplateParams);

router.post("/templates",
     authenticateToken,
    checkRole(['admin', "graduation_thesis_manager", "examination_officer", "academic_officer",]),
    emailTemplateController.createTemplate);

router.put("/templates/:id",
     authenticateToken,
    checkRole(['admin', "graduation_thesis_manager", "examination_officer", "academic_officer",]),
    emailTemplateController.updateTemplate);

router.delete("/templates/:id",
    authenticateToken,
    checkRole(['admin', "graduation_thesis_manager", "examination_officer", "academic_officer",]),
    emailTemplateController.deleteTemplate);

export default router;
