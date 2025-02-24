// system.config.routes.ts
import { Router } from "express";
import { SystemConfigController } from "../controller/system.config.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = Router();
const controller = new SystemConfigController();

// Lấy cấu hình (GET /api/config?key=...)
router.get(
  "/",
  authenticateToken,
  checkRole(["admin"]),
  controller.getConfig.bind(controller)
);

// Cập nhật cấu hình (PUT /api/config)
router.put(
  "/",
  authenticateToken,
  checkRole(["admin"]),
  controller.updateConfig.bind(controller)
);

export default router;
