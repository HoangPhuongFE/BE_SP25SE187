import { Router } from "express";
import { EmailTemplateController } from "../controller/emailTemplate.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = Router();
const emailTemplateController = new EmailTemplateController();

// Lấy danh sách tất cả template
router.get("/", authenticateToken, checkRole(["admin"]), emailTemplateController.getAllTemplates.bind(emailTemplateController));

// Lấy chi tiết template theo ID
router.get("/:id", authenticateToken, checkRole(["admin"]), emailTemplateController.getTemplateById.bind(emailTemplateController));

// Tạo template mới
router.post("/", authenticateToken, checkRole(["admin","academic_officer"]), emailTemplateController.createTemplate.bind(emailTemplateController));

// Cập nhật template
router.put("/:id", authenticateToken, checkRole(["admin","academic_officer"]), emailTemplateController.updateTemplate.bind(emailTemplateController));

// Xóa template
router.delete("/:id", authenticateToken, checkRole(["admin","academic_officer"]), emailTemplateController.deleteTemplate.bind(emailTemplateController));

export default router;
