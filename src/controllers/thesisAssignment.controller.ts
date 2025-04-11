import { Request, Response } from 'express';
import HTTP_STATUS from '../constants/httpStatus';
import { ThesisAssignmentService } from '../services/thesisAssignment.service';

const thesisAssignmentService = new ThesisAssignmentService();

export class ThesisAssignmentController {
  // Get the list of approved thesis assignments for guidance
  async getThesisGuidanceList(req: Request, res: Response) {
    try {
      const { semesterId, submissionPeriodId, includeAI } = req.query;
  
      const result = await thesisAssignmentService.getThesisGuidanceList({
        semesterId: semesterId as string,
        submissionPeriodId: submissionPeriodId as string,
        includeAI: includeAI === 'true',
      });
  
      return res.status(result.status).json(result);
    } catch (error) {
      console.error('Error in getThesisGuidanceList:', error);
      return res.status(500).json({
        success: false,
        message: 'System error while retrieving thesis guidance list!',
      });
    }
  }
  
}