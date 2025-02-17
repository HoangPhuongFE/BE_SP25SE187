import { Router } from "express";
import { ConfigController } from "../controller/config.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = Router();
const configController = new ConfigController();

//  Lấy danh sách cấu hình hệ thống
router.get("/", authenticateToken, configController.getAllConfigs.bind(configController));

//  Admin cập nhật giá trị cấu hình
router.post("/update", authenticateToken, checkRole(["admin"]), configController.updateConfig.bind(configController));

export default router;
