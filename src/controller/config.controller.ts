import { Request, Response } from "express";
import { ConfigService } from "../service/config.service";
import { AuthenticatedRequest } from "../middleware/user.middleware";

export class ConfigController {
    // 🔹 Lấy danh sách cấu hình
    async getAllConfigs(req: AuthenticatedRequest, res: Response) {
        try {
            const result = await ConfigService.getAllConfigs();
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ message: (error as Error).message });
        }
    }

    // 🔹 Cập nhật giá trị cấu hình (Chỉ Admin)
    async updateConfig(req: AuthenticatedRequest, res: Response) {
        try {
            const { key, value } = req.body;
            const result = await ConfigService.updateConfig(key, value, req.user!.userId);
            res.status(200).json(result);
        } catch (error) {
            res.status(403).json({ message: (error as Error).message });
        }
    }
}
