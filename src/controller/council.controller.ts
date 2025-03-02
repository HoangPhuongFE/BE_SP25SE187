import { Request, Response } from 'express';
import { CouncilService } from '../service/council.service';
import HTTP_STATUS from '../constants/httpStatus';
import COUNCIL_MESSAGE from '../constants/message';

const councilService = new CouncilService();

export class CouncilController {
    async createCouncil(req: Request, res: Response) {
        try {
            console.log(" Dữ liệu nhận được từ request:", req.body);
            const { name, code, type, round, semesterId, status,submissionPeriodId  } = req.body;
    
            if (!semesterId) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    message: "Thiếu `semesterId`, vui lòng kiểm tra lại."
                });
            }
    
            const result = await councilService.createCouncil({
                name,
                code,
                type,
                round,
                semesterId,
                status,
                topicAssId: null,
                submissionPeriodId  
            });
    
            return res.status(result.status).json(result);
        } catch (error) {
            console.error(" Lỗi khi tạo hội đồng:", error);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: COUNCIL_MESSAGE.COUNCIL_CREATION_FAILED
            });
        }
    }
    
    async addMembers(req: Request, res: Response) {
        try {
            const { councilId } = req.params;
            const { members } = req.body; 
    
            if (!members || members.length === 0) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    message: "Danh sách thành viên không được để trống."
                });
            }
    
            const result = await councilService.addCouncilMembers(councilId, members);
            return res.status(result.status).json(result);
        } catch (error) {
            console.error(error);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: COUNCIL_MESSAGE.COUNCIL_MEMBERS_FAILED
            });
        }
    }
    

    async getCouncils(req: Request, res: Response) {
        try {
            const { semesterId, type } = req.query;
            const result = await councilService.getCouncils({
                semesterId: semesterId as string,
                type: type as string
            });

            return res.status(result.status).json(result);
        } catch (error) {
            console.error(error);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: COUNCIL_MESSAGE.COUNCIL_LIST_FAILED
            });
        }
    }
    async getLecturersRolesInSemester(req: Request, res: Response) {
      try {
          const { semesterId } = req.params;

          if (!semesterId) {
              return res.status(HTTP_STATUS.BAD_REQUEST).json({
                  success: false,
                  message: COUNCIL_MESSAGE.INVALID_SEMESTER_ID
              });
          }

          const result = await councilService.getLecturersRolesInSemester(semesterId);
          return res.status(result.status).json(result);
      } catch (error) {
          console.error(error);
          return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
              success: false,
              message: COUNCIL_MESSAGE.LECTURERS_ROLES_FAILED
          });
      }
  }


  async removeCouncilMember(req: Request, res: Response) {
    try {
        const { councilId } = req.params;
        const { userId, email } = req.body;

        if (!councilId || (!userId && !email)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: COUNCIL_MESSAGE.INVALID_REQUEST
            });
        }

        const result = await councilService.removeCouncilMember(councilId, userId, email);
        return res.status(result.status).json(result);
    } catch (error) {
        console.error(error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: COUNCIL_MESSAGE.COUNCIL_MEMBER_REMOVE_FAILED
        });
    }
}

async removeCouncil(req: Request, res: Response) {
    try {
        const { councilId } = req.params;

        if (!councilId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "Thiếu `councilId`, vui lòng kiểm tra lại."
            });
        }

        const result = await councilService.deleteCouncil(councilId);
        return res.status(result.status).json(result);
    } catch (error) {
        console.error(error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Lỗi server khi xóa hội đồng."
        });
    }
}

}
