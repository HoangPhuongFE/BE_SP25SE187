// system.config.controller.ts
import { Request, Response } from "express";
import { SystemConfigService } from "../service/system.config.service";

const systemConfigService = new SystemConfigService();

export class SystemConfigController {
  /**
   * Lấy giá trị cấu hình dựa theo key được truyền qua query string.
   * Ví dụ: GET /api/config?key=MAX_GROUP_MEMBERS
   */
  async getConfig(req: Request, res: Response) {
    try {
      const key = req.query.key as string;
      if (!key) {
        return res.status(400).json({ message: "Config key is required" });
      }
      const defaultValue =
        key === "MAX_GROUP_MEMBERS"
          ? 5
          : key === "MAX_GROUP_MENTORS"
          ? 1
          : "";
      const configValue = await systemConfigService.getSystemConfigValue(key, defaultValue);
      return res.json({ key, value: configValue });
    } catch (error) {
      return res.status(500).json({ message: (error as Error).message });
    }
  }

  /**
   * Cập nhật cấu hình. Yêu cầu body phải có: { key, value, description? }.
   * Yêu cầu người gọi có quyền admin (được kiểm tra qua middleware).
   */
  async updateConfig(req: Request, res: Response) {
    try {
      const { key, value, description } = req.body;
      if (!key || !value) {
        return res.status(400).json({ message: "Key and value are required" });
      }
      // Giả sử middleware authenticateToken đã thêm thông tin user vào req.user
      const updatedBy = (req as any).user?.userId || "system";
      const updatedConfig = await systemConfigService.updateSystemConfig(key, value, updatedBy, description);
      return res.json({ message: "Configuration updated successfully.", config: updatedConfig });
    } catch (error) {
      return res.status(500).json({ message: (error as Error).message });
    }
  }
}
