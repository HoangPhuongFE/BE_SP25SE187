import { Request, Response } from 'express';
import { CouncilService } from '../service/council.service';
import HTTP_STATUS from '../constants/httpStatus';
import COUNCIL_MESSAGE from '../constants/message';

const councilService = new CouncilService();

export class CouncilController {
    async createCouncil(req: Request, res: Response) {
        try {
            const { name, type, round, semesterId, status } = req.body;
            const result = await councilService.createCouncil({
                name,
                type,
                round,
                semesterId,
                status,
                topicAssId: null
            });

            return res.status(result.status).json(result);
        } catch (error) {
            console.error(error);
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
        const { councilId, userId } = req.params;

        if (!councilId || !userId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: COUNCIL_MESSAGE.INVALID_REQUEST
            });
        }

        const result = await councilService.removeCouncilMember(councilId, userId);
        return res.status(result.status).json(result);
    } catch (error) {
        console.error(error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: COUNCIL_MESSAGE.COUNCIL_MEMBER_REMOVE_FAILED
        });
    }
}

}
