import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/user.middleware";
import { MeetingService } from "../service/meeting.service";
import HTTP_STATUS from "../constants/httpStatus";
import { MEETING_MESSAGE } from "../constants/message";

export class MeetingController {
  private meetingService = new MeetingService();

  async createMeeting(req: AuthenticatedRequest, res: Response) {
    try {
      const mentorId = req.user!.userId;
      const { groupId, meetingTime, location, agenda } = req.body;

      const meeting = await this.meetingService.createMeeting({
        mentorId,
        groupId,
        meetingTime,
        location,
        agenda
      });

      res.status(HTTP_STATUS.CREATED).json({
        message: MEETING_MESSAGE.MEETING_CREATED,
        data: meeting
      });
    } catch (error) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: (error as Error).message
      });
    }
  }

  async updateMeeting(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const mentorId = req.user!.userId;
      const updateData = req.body;

      const meeting = await this.meetingService.updateMeeting(id, mentorId, updateData);

      res.status(HTTP_STATUS.OK).json({
        message: MEETING_MESSAGE.MEETING_UPDATED,
        data: meeting
      });
    } catch (error) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: (error as Error).message
      });
    }
  }

  async deleteMeeting(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const mentorId = req.user!.userId;

      await this.meetingService.deleteMeeting(id, mentorId);

      res.status(HTTP_STATUS.OK).json({
        message: MEETING_MESSAGE.MEETING_DELETED
      });
    } catch (error) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: (error as Error).message
      });
    }
  }

  async getMeetingsByGroup(req: AuthenticatedRequest, res: Response) {
    try {
      const { groupId } = req.params;
      const meetings = await this.meetingService.getMeetingsByGroup(groupId);

      res.status(HTTP_STATUS.OK).json({
        data: meetings
      });
    } catch (error) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: (error as Error).message
      });
    }
  }
}
