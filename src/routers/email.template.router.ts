import { Router } from "express";
import { EmailTemplateController } from "../controllers/emailTemplate.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";
import { wrapAsync } from "../utils/handler"; // Đường dẫn tùy thuộc project bạn

const controller = new EmailTemplateController();
const router = Router();
const roles = ["admin", "graduation_thesis_manager", "examination_officer", "academic_officer"];

router.get("/templates", authenticateToken, checkRole(roles), wrapAsync(controller.getAllTemplates));
router.get("/templates/:id", authenticateToken, checkRole(roles), wrapAsync(controller.getTemplateById));
router.get("/templates/:id/params", authenticateToken, checkRole(roles), wrapAsync(controller.getTemplateParams));
router.post("/templates", authenticateToken, checkRole(roles), wrapAsync(controller.createTemplate));
router.put("/templates/:id", authenticateToken, checkRole(roles), wrapAsync(controller.updateTemplate));
router.put("/templates/:id/delete", authenticateToken, checkRole(roles), wrapAsync(controller.deleteTemplate));

export default router;
