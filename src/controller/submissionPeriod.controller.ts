import { Request, Response } from "express";
import { SubmissionPeriodService } from "../service/submissionPeriod.service";
import HTTP_STATUS from "../constants/httpStatus";

const service = new SubmissionPeriodService();

export class SubmissionPeriodController {
  async createSubmissionPeriod(req: Request, res: Response) {
    const { semesterId, roundNumber, startDate, endDate, description } = req.body;
    const createdBy = req.user!.userId; // Lấy từ token

    const result = await service.createSubmissionPeriod({ semesterId, roundNumber, startDate, endDate, description, createdBy });

    return res.status(result.status).json(result);
  }

  async updateSubmissionPeriod(req: Request, res: Response) {
    const { periodId } = req.params;
    const result = await service.updateSubmissionPeriod(periodId, req.body);

    return res.status(result.status).json(result);
  }

  async getSubmissionPeriods(req: Request, res: Response) {
    const { semesterId } = req.params;
    const result = await service.getSubmissionPeriods(semesterId);

    return res.status(result.status).json(result);
  }

  async getSubmissionPeriodById(req: Request, res: Response) {
    const { periodId } = req.params;
    const result = await service.getSubmissionPeriodById(periodId);

    return res.status(result.status).json(result);
  }

  async deleteSubmissionPeriod(req: Request, res: Response) {
    const { periodId } = req.params;
    const result = await service.deleteSubmissionPeriod(periodId);

    return res.status(result.status).json(result);
  }
}
