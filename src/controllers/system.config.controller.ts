import { Request, Response } from "express";
import { SystemConfigService } from "../services/system.config.service";

const systemConfigService = new SystemConfigService();

export class SystemConfigController {
  async getConfig(req: Request, res: Response) {
    try {
      const key = req.query.key as string;
      if (!key) {
        return res.status(400).json({ success: false, message: "Config key is required" });
      }

      const validKeys = await systemConfigService.getAllConfigKeys();
      const validKey = validKeys.find(k => k.key === key);
      if (!validKey) {
        return res.status(400).json({ 
          success: false, 
          message: `Invalid config key: ${key}. Use GET /api/config/keys to see valid keys.` 
        });
      }

      const configValue = await systemConfigService.getSystemConfigValue(key, validKey.defaultValue);
      return res.status(200).json({ success: true, data: { key, value: configValue } });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        message: `Error fetching config: ${(error as Error).message}` 
      });
    }
  }

  async updateConfig(req: Request, res: Response) {
    try {
      const { key, value, description } = req.body;
      if (!key || value === undefined) {
        return res.status(400).json({ success: false, message: "Key and value are required" });
      }

      const validKeys = await systemConfigService.getAllConfigKeys();
      if (!validKeys.some(k => k.key === key)) {
        return res.status(400).json({ 
          success: false, 
          message: `Invalid config key: ${key}. Use GET /api/config/keys to see valid keys.` 
        });
      }

      const updatedBy = (req as any).user?.userId;
      if (!updatedBy) {
        return res.status(401).json({ success: false, message: "Unauthorized: User ID not found in token" });
      }

      const ipAddress = req.ip || "unknown";
      const updatedConfig = await systemConfigService.updateSystemConfig(
        key,
        value.toString(),
        updatedBy,
        description,
        ipAddress
      );

      return res.status(200).json({ 
        success: true, 
        message: "Configuration updated successfully", 
        data: updatedConfig 
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        message: `Error updating config: ${(error as Error).message}` 
      });
    }
  }

  async getAllKeys(req: Request, res: Response) {
    try {
      const keys = await systemConfigService.getAllConfigKeys();
      return res.status(200).json({ success: true, data: keys });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        message: `Error fetching config keys: ${(error as Error).message}` 
      });
    }
  }
}