import { Request, Response } from 'express';
import { InterMajorConfigService } from '../services/interMajorConfig.service';
import { AuthenticatedRequest } from '../middleware/user.middleware';

const interMajorConfigService = new InterMajorConfigService();

export class InterMajorConfigController {
  async createConfig(req: Request, res: Response) {
    const result = await interMajorConfigService.createConfig(req.body);
    res.status(result.status).json({ message: result.message, data: result.data });
  }

  async getAllConfigs(req: AuthenticatedRequest, res: Response) {
    // Kiểm tra vai trò student
    const isStudent = req.user?.roles.some((role) => role.name === 'student');
    
    // Nếu là student, không yêu cầu semesterId
    if (isStudent) {
      const result = await interMajorConfigService.getAllConfigs();
      return res.status(result.status).json({ message: result.message, data: result.data });
    }
  
    // Các vai trò khác yêu cầu semesterId
    const semesterId = req.params.semesterId || req.body.semesterId || req.query.semesterId;
    if (!semesterId) {
      return res.status(400).json({ message: 'Missing semesterId for semester-specific action' });
    }
  
    const result = await interMajorConfigService.getAllConfigs(semesterId);
    res.status(result.status).json({ message: result.message, data: result.data });
  }

  async getConfigById(req: Request, res: Response) {
    const { id } = req.params;
    const result = await interMajorConfigService.getConfigById(id);
    res.status(result.status).json({ message: result.message, data: result.data });
  }

  async updateConfig(req: Request, res: Response) {
    const { id } = req.params;
    const result = await interMajorConfigService.updateConfig(id, req.body);
    res.status(result.status).json({ message: result.message, data: result.data });
  }

  async deleteConfig(req: Request, res: Response) {
    const { id } = req.params;
    const result = await interMajorConfigService.deleteConfig(id);
    res.status(result.status).json({ message: result.message });
  }
}
