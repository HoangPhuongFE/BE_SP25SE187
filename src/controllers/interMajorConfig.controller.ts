import { Request, Response } from 'express';
import { InterMajorConfigService } from '../services/interMajorConfig.service';

const interMajorConfigService = new InterMajorConfigService();

export class InterMajorConfigController {
  async createConfig(req: Request, res: Response) {
    const result = await interMajorConfigService.createConfig(req.body);
    res.status(result.status).json({ message: result.message, data: result.data });
  }

  async getAllConfigs(req: Request, res: Response) {
    const { semesterId } = req.query;
    const result = await interMajorConfigService.getAllConfigs(String(semesterId));
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
