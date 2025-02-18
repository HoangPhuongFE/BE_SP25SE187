import { Router } from "express";
import { ConfigController } from "../controller/config.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = Router();
const configController = new ConfigController();

//  Lấy danh sách cấu hình hệ thống
router.get("/", authenticateToken, configController.getAllConfigs.bind(configController));

//  Admin cập nhật giá trị cấu hình
router.post("/update", authenticateToken, checkRole(["admin"]), configController.updateConfig.bind(configController));

// Lấy cấu hình theo các key được lọc (ví dụ: ?keys=CHANGE_LEADER_DEADLINE_DAYS,MAX_GROUP_MEMBERS)
router.get("/filter", authenticateToken, configController.getFilteredConfigs.bind(configController));

export default router;
