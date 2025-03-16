  import { Request, Response } from 'express';
  import HTTP_STATUS from '../constants/httpStatus';
  import COUNCIL_MESSAGE from '../constants/message';
  import { CouncilTopicService } from '../service/council.topic.service';

  const councilTopicService = new CouncilTopicService();

  export class CouncilTopicController {



  
      async createCouncil(req: Request, res: Response) {
        const { name, semesterId, submissionPeriodId, startDate, endDate, status, type, round } = req.body;
        const createdBy = req.user!.userId;
    
        const result = await councilTopicService.createCouncil({
          name,
          semesterId,
          submissionPeriodId,
          createdBy,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          status,
          type,
          round,
        });
    
        return res.status(result.status).json(result);
      }
    
      async updateCouncil(req: Request, res: Response) {
        try {
          const { id } = req.params;
          const { name, code, round, status, councilStartDate, councilEndDate } = req.body;
          const result = await councilTopicService.updateTopicCouncil(id, {
            name,
            code,
            round,
            status,
            councilStartDate: councilStartDate ? new Date(councilStartDate) : undefined,
            councilEndDate: councilEndDate ? new Date(councilEndDate) : undefined,
          });
          return res.status(result.status).json(result);
        } catch (error) {
          console.error("Lỗi trong updateCouncil:", error);
          return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: COUNCIL_MESSAGE.COUNCIL_UPDATE_FAILED
          });
        }
      }
  
    


    // Lấy danh sách hội đồng topic
    async getCouncils(req: Request, res: Response) {
      try {
        const { semesterId, submissionPeriodId, round } = req.query;
        const result = await councilTopicService.getTopicCouncils({
          semesterId: semesterId as string,
          submissionPeriodId: submissionPeriodId as string,
          round: round ? Number(round) : undefined
        });
        return res.status(result.status).json(result);
      } catch (error) {
        console.error("Lỗi trong getCouncils:", error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: COUNCIL_MESSAGE.COUNCIL_LIST_FAILED
        });
      }
    }

    // Lấy chi tiết hội đồng topic theo id
    async getCouncilById(req: Request, res: Response) {
      try {
        const { id } = req.params;
        const result = await councilTopicService.getTopicCouncilById(id);
        return res.status(result.status).json(result);
      } catch (error) {
        console.error("Lỗi trong getCouncilById:", error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: COUNCIL_MESSAGE.COUNCIL_LIST_FAILED
        });
      }
    }

   

    // Xóa hội đồng topic
    async deleteCouncil(req: Request, res: Response) {
      try {
        const { id } = req.params;
        const result = await councilTopicService.deleteTopicCouncil(id);
        return res.status(result.status).json(result);
      } catch (error) {
        console.error("Lỗi trong deleteCouncil:", error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: "Lỗi hệ thống khi xóa hội đồng."
        });
      }
    }

    async addMemberToCouncil(req: Request, res: Response) {
      try {
        const { councilId } = req.params; //  Đổi từ req.params -> req.query
        const { email, role } = req.body;
        const addedBy = req.user!.userId;
    
        if (!councilId) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Thiếu councilId!" });
        }
    
        const result = await councilTopicService.addMemberToCouncil(councilId as string, { email, role, addedBy });
    
        return res.status(result.status).json(result);
      } catch (error) {
        console.error("Lỗi khi thêm thành viên vào hội đồng:", error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Lỗi hệ thống!" });
      }
    }
   

    async removeMemberFromCouncil(req: Request, res: Response) {
      try {
        const { councilId, userId } = req.params;
    
        if (!councilId || !userId) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Thiếu councilId hoặc userId!" });
        }
    
        const result = await councilTopicService.removeMemberFromCouncil(councilId as string, userId as string);
    
        return res.status(result.status).json(result);
      } catch (error) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Lỗi hệ thống!" });
      }
    }
    
  }
