// src/controllers/interMajorGroup.controller.ts
import { Request, Response } from "express";
import { InterMajorGroupService } from "../services/interMajorGroup.service";
import { AuthenticatedRequest } from "../middleware/user.middleware";

const interMajorGroupService = new InterMajorGroupService();

export class InterMajorGroupController {
  async createGroup(req: AuthenticatedRequest, res: Response) {
    try {
      const { majorPairConfigId } = req.body;
      if (!majorPairConfigId) {
        return res.status(400).json({ success: false, message: "Thiếu majorPairConfigId!" });
      }

      const result = await interMajorGroupService.createGroup({
        leaderId: req.user!.userId, // lấy từ token
        majorPairConfigId,
      });

      return res.status(result.status).json(result);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Lỗi server khi tạo nhóm liên ngành" });
    }
  }
}
