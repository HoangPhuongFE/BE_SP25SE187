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
  "/update",
  authenticateToken,
  checkRole(["admin"]),
  controller.updateConfig.bind(controller)
);

// Lấy danh sách key hợp lệ (GET /api/config/keys)
router.get(
  "/keys",
  authenticateToken,
  checkRole(["admin"]),
  controller.getAllKeys.bind(controller)
);

export default router;