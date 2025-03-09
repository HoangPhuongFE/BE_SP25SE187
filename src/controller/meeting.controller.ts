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
      const { groupId, meetingTime, location, agenda, url } = req.body;

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
        url,
      });

      // Lấy thông tin chi tiết của meeting vừa tạo
      const meetingDetail = await this.meetingService.getMeetingById(meeting.id);

      res.status(HTTP_STATUS.CREATED).json({
        message: MEETING_MESSAGE.MEETING_CREATED,
        data: meetingDetail,
      });
    } catch (error) {
      console.error("Error creating meeting:", error);
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

      //  Cập nhật meeting
      const updatedMeeting = await this.meetingService.updateMeeting(id, mentorId, updateData);

      // Lấy thông tin chi tiết của meeting sau khi cập nhật
      const meetingDetail = await this.meetingService.getMeetingById(updatedMeeting.id);

      res.status(HTTP_STATUS.OK).json({
        message: MEETING_MESSAGE.MEETING_UPDATED,
        data: meetingDetail,
      });
    } catch (error) {
      console.error("Error updating meeting:", error);
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

      //  Xóa meeting
      await this.meetingService.deleteMeeting(id, mentorId);

      res.status(HTTP_STATUS.OK).json({
        message: MEETING_MESSAGE.MEETING_DELETED,
      });
    } catch (error) {
      console.error("Error deleting meeting:", error);
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

      // Kiểm tra xem groupId là id hay code
      let group;
      
      // Nếu là UUID thì tìm theo id, nếu không thì tìm theo code
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(groupId);
      
      if (isUUID) {
        group = await prisma.group.findUnique({
          where: { id: groupId },
        });
      } else {
        group = await prisma.group.findUnique({
          where: { groupCode: groupId },
        });
      }

      if (!group) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          message: MEETING_MESSAGE.GROUP_NOT_FOUND,
        });
      }

      //  Lấy danh sách meetings
      const meetings = await this.meetingService.getMeetingsByGroup(group.id);

      res.status(HTTP_STATUS.OK).json({
        data: meetings,
      });
    } catch (error) {
      console.error("Error getting meetings by group:", error);
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: (error as Error).message,
      });
    }
  }

  /**
   *  Lấy thông tin chi tiết của một meeting
   */
  async getMeetingById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      //  Lấy thông tin chi tiết meeting
      const meeting = await this.meetingService.getMeetingById(id);

      res.status(HTTP_STATUS.OK).json({
        data: meeting,
      });
    } catch (error) {
      console.error("Error getting meeting by id:", error);
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: (error as Error).message,
      });
    }
  }

  /**
   * Lấy tất cả meeting của một mentor (cả mentor chính và mentor phụ)
   */
  async getMeetingsByMentor(req: AuthenticatedRequest, res: Response) {
    try {
      const mentorId = req.user!.userId;
      const { semesterId } = req.query; // Lấy semesterId từ query params

      // Kiểm tra xem người dùng có vai trò mentor không
      const hasRoleMentor = req.user!.roles.some(role => role.roleId === 'mentor');
      
      if (!hasRoleMentor) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          message: "Bạn không có quyền truy cập tài nguyên này",
        });
      }

      // Lấy danh sách meeting
      const meetings = await this.meetingService.getMeetingsByMentor(
        mentorId, 
        semesterId as string | undefined
      );

      res.status(HTTP_STATUS.OK).json({
        data: meetings,
      });
    } catch (error) {
      console.error("Error getting meetings by mentor:", error);
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: (error as Error).message,
      });
    }
  }
}
