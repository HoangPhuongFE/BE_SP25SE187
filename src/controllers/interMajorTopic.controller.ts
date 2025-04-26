import { Request, Response } from "express";
import { InterMajorTopicService } from "../services/interMajorTopic.service";
import { AuthenticatedRequest } from "../middleware/user.middleware";

const interMajorTopicService = new InterMajorTopicService();

export class InterMajorTopicController {
  async createInterMajorTopic(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await interMajorTopicService.createInterMajorTopic({
        ...req.body,
        createdBy: req.user!.userId, // Lấy từ token
      });

      return res.status(result.status).json(result);
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Lỗi server khi tạo đề tài liên ngành",
      });
    }
  }
  async createInterMajorTopicWithMentors(req: AuthenticatedRequest, res: Response) {
    try {
      const createdBy = req.user?.userId;
      if (!createdBy) {
        return res.status(401).json({ success: false, message: 'Unauthorized!' });
      }

      const result = await interMajorTopicService.createInterMajorTopicWithMentors({
        ...req.body,
        createdBy,
      });

      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Error in InterMajorTopicController:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}





