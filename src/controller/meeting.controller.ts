import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/user.middleware";
import { MeetingService } from "../service/meeting.service";
import HTTP_STATUS from "../constants/httpStatus";
import { MEETING_MESSAGE } from "../constants/message";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class MeetingController {
  private meetingService = new MeetingService();

  /**
   * 📌 Tạo meeting mới
   */
  async createMeeting(req: AuthenticatedRequest, res: Response) {
    try {
      const mentorId = req.user!.userId;
      const { groupId, meetingTime, location, agenda } = req.body;

      //  Kiểm tra mentor có thuộc nhóm không
      const isMentor = await prisma.groupMentor.findFirst({
        where: {
          groupId,
          mentorId,
        },
      });

      if (!isMentor) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          message: MEETING_MESSAGE.UNAUTHORIZED_MENTOR,
        });
      }

      //  Tạo meeting
      const meeting = await this.meetingService.createMeeting({
        mentorId,
        groupId,
        meetingTime,
        location,
        agenda,
      });

      res.status(HTTP_STATUS.CREATED).json({
        message: MEETING_MESSAGE.MEETING_CREATED,
        data: meeting,
      });
    } catch (error) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: (error as Error).message,
      });
    }
  }

  /**
   * 📌 Cập nhật meeting
   */
  async updateMeeting(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const mentorId = req.user!.userId;
      const updateData = req.body;

      //  Kiểm tra quyền mentor
      const meeting = await prisma.meetingSchedule.findUnique({
        where: { id },
      });

      if (!meeting) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          message: MEETING_MESSAGE.MEETING_NOT_FOUND,
        });
      }

      if (meeting.mentorId !== mentorId) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          message: MEETING_MESSAGE.UNAUTHORIZED_MENTOR,
        });
      }

      //  Cập nhật meeting
      const updatedMeeting = await this.meetingService.updateMeeting(id, mentorId, updateData);

      res.status(HTTP_STATUS.OK).json({
        message: MEETING_MESSAGE.MEETING_UPDATED,
        data: updatedMeeting,
      });
    } catch (error) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: (error as Error).message,
      });
    }
  }

  /**
   *  Xóa meeting
   */
  async deleteMeeting(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const mentorId = req.user!.userId;

      //  Kiểm tra quyền mentor
      const meeting = await prisma.meetingSchedule.findUnique({
        where: { id },
      });

      if (!meeting) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          message: MEETING_MESSAGE.MEETING_NOT_FOUND,
        });
      }

      if (meeting.mentorId !== mentorId) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          message: MEETING_MESSAGE.UNAUTHORIZED_MENTOR,
        });
      }

      //  Xóa meeting
      await this.meetingService.deleteMeeting(id, mentorId);

      res.status(HTTP_STATUS.OK).json({
        message: MEETING_MESSAGE.MEETING_DELETED,
      });
    } catch (error) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: (error as Error).message,
      });
    }
  }

  /**
   *  Lấy danh sách meetings theo groupId
   */
  async getMeetingsByGroup(req: AuthenticatedRequest, res: Response) {
    try {
      const { groupId } = req.params;

      //  Kiểm tra group có tồn tại không
      const group = await prisma.group.findUnique({
        where: { id: groupId },
      });

      if (!group) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          message: MEETING_MESSAGE.GROUP_NOT_FOUND,
        });
      }

      //  Lấy danh sách meetings
      const meetings = await this.meetingService.getMeetingsByGroup(groupId);

      res.status(HTTP_STATUS.OK).json({
        data: meetings,
      });
    } catch (error) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: (error as Error).message,
      });
    }
  }
}
