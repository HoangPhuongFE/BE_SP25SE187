import { Request, Response } from 'express';
import { CouncilDefenseService } from '../services/council.defense.service';
import HTTP_STATUS from '../constants/httpStatus';

const councilDefenseService = new CouncilDefenseService();

export class CouncilDefenseController {
  async createDefenseCouncil(req: Request, res: Response) {
    try {
      // Lấy userId từ token (req.user)
      const userId = req.user?.userId; // Sử dụng userId thay vì id
            if (!userId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          status: HTTP_STATUS.UNAUTHORIZED,
          message: 'Không tìm thấy thông tin người dùng từ token!',
        });
      }
  
      // Tạo dữ liệu đầu vào cho service, loại bỏ createdBy từ req.body
      const data = {
        name: req.body.name,
        semesterId: req.body.semesterId,
        submissionPeriodId: req.body.submissionPeriodId,
        startDate: new Date(req.body.startDate), // Chuyển đổi sang Date
        endDate: new Date(req.body.endDate),     // Chuyển đổi sang Date
        status: req.body.status,
        defenseRound: req.body.defenseRound,
      };
  
      const result = await councilDefenseService.createDefenseCouncil({ ...data, createdBy: userId });
      res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong controller createDefenseCouncil:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống trong controller!',
      });
    }
  }

  async addMemberToCouncil(req: Request, res: Response) {
    try {
      const { councilId } = req.params;
      const result = await councilDefenseService.addMemberToCouncil(councilId, req.body);
      res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong controller addMemberToCouncil:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống trong controller!',
      });
    }
  }

  async createDefenseSchedule(req: Request, res: Response) {
    try {
      const result = await councilDefenseService.createDefenseSchedule(req.body);
      res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong controller createDefenseSchedule:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống trong controller!',
      });
    }
  }

  async deleteDefenseCouncil(req: Request, res: Response) {
    try {
      const { councilId } = req.params;
      const userId = req.user?.userId;
      const result = await councilDefenseService.deleteDefenseCouncil(councilId, userId!);
      res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong controller deleteDefenseCouncil:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống trong controller!',
      });
    }
  }

  async updateDefenseCouncil(req: Request, res: Response) {
    try {
      const { councilId } = req.params;
      const result = await councilDefenseService.updateDefenseCouncil(councilId, req.body);
      res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong controller updateDefenseCouncil:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống trong controller!',
      });
    }
  }

  async getDefenseScheduleForMentor(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const result = await councilDefenseService.getDefenseScheduleForMentor(userId!);
      res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong controller getDefenseScheduleForMentor:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống trong controller!',
      });
    }
  }

  async getDefenseScheduleForStudent(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const result = await councilDefenseService.getDefenseScheduleForStudent(userId!);
      res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong controller getDefenseScheduleForStudent:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống trong controller!',
      });
    }
  }

  async addUrlToDefenseSchedule(req: Request, res: Response) {
    try {
      const { scheduleId } = req.params;
      const { url } = req.body;
      const userId = req.user?.userId;
      const result = await councilDefenseService.addUrlToDefenseSchedule(scheduleId, url, userId!);
      res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong controller addUrlToDefenseSchedule:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống trong controller!',
      });
    }
  }

  async getDefenseCouncilDetailsForMember(req: Request, res: Response) {
    try {
      const { councilId } = req.params;
      const userId = req.user?.id;
      const result = await councilDefenseService.getDefenseCouncilDetailsForMember(councilId, userId!);
      res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong controller getDefenseCouncilDetailsForMember:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống trong controller!',
      });
    }
  }

  async evaluateDefenseMember(req: Request, res: Response) {
    try {
      const { defenseScheduleId, studentId } = req.params;
      const userId = req.user?.id;
      const result = await councilDefenseService.evaluateDefenseMember(defenseScheduleId, studentId, req.body, userId!);
      res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong controller evaluateDefenseMember:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống trong controller!',
      });
    }
  }

  async getDefenseCouncils(req: Request, res: Response) {
    try {
      const filter = {
        semesterId: req.query.semesterId as string,
        submissionPeriodId: req.query.submissionPeriodId as string,
        round: req.query.round ? parseInt(req.query.round as string) : undefined,
        user: req.user ? { userId: req.user.id, roles: req.user.roles || [] } : undefined,
      };
      const result = await councilDefenseService.getDefenseCouncils(filter);
      res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong controller getDefenseCouncils:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống trong controller!',
      });
    }
  }

  async getDefenseCouncilById(req: Request, res: Response) {
    try {
      const { councilId } = req.params;
      const result = await councilDefenseService.getDefenseCouncilById(councilId);
      res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong controller getDefenseCouncilById:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống trong controller!',
      });
    }
  }

  async updateDefenseCouncilMembers(req: Request, res: Response) {
    try {
      const { councilId } = req.params;
      const { members } = req.body;
      const updatedBy = req.user?.userId;
      const result = await councilDefenseService.updateDefenseCouncilMembers(councilId, members!);
      res.status(result.status).json(result);
    } catch (error) {
      console.error('Lỗi trong controller updateDefenseCouncilMembers:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống trong controller!',
      });
    }
  }


  async removeCouncilMember(req: Request, res: Response) {
    try {
        const { councilId, userId } = req.params;
        const actionByUserId = req.user?.userId;
  
        if (!actionByUserId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: "Không tìm thấy thông tin người dùng từ token!",
            });
        }
  
        const result = await councilDefenseService.removeCouncilMember(councilId, userId, actionByUserId);
        res.status(result.status).json(result);
    } catch (error) {
        console.error("Lỗi trong controller removeCouncilMember:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Lỗi hệ thống trong controller!",
        });
    }
  }
  
  async updateDefenseScheduleStatus(req: Request, res: Response) {
    try {
      const { scheduleId } = req.params;
      const { status, notes } = req.body;
      const userId = req.user?.userId;
  
      const result = await councilDefenseService.updateDefenseScheduleStatus(
        scheduleId,
        { status, notes },
        userId!
      );
  
      res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi trong controller updateDefenseScheduleStatus:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống trong controller!",
      });
    }
  }
  
}