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

    async getFilteredConfigs(req: AuthenticatedRequest, res: Response) {
        try {
            // Giả sử client truyền key dưới dạng query parameter: ?keys=CHANGE_LEADER_DEADLINE_DAYS,MAX_GROUP_MEMBERS
            const keysParam = req.query.keys as string;
            if (!keysParam) {
                return res.status(400).json({ message: "Vui lòng cung cấp danh sách key cần lọc." });
            }
            const keys = keysParam.split(",").map(key => key.trim());
            const result = await ConfigService.getFilteredConfigs(keys);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ message: (error as Error).message });
        }
    }

}
