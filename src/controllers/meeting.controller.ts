import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/user.middleware";
import { MeetingService } from "../services/meeting.service";
import HTTP_STATUS from "../constants/httpStatus";
import { MEETING_MESSAGE } from "../constants/message";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class MeetingController {
  private meetingService = new MeetingService();


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

 
  async deleteMeeting(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const mentorId = req.user!.userId;
      const ipAddress = req.ip; // Lấy địa chỉ IP từ request
  
      if (!id) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          message: 'Thiếu ID cuộc họp.',
        });
      }
  
      const result = await this.meetingService.deleteMeeting(id, mentorId, ipAddress);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      console.error('Error marking meeting as deleted:', error);
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: error instanceof Error ? error.message : 'Lỗi khi đánh dấu xóa cuộc họp.',
      });
    }
  }

 
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
        // Tìm học kỳ hiện tại nếu không có semesterId
        const currentSemester = await prisma.semester.findFirst({
          where: { status: 'ACTIVE' },
          orderBy: { startDate: 'desc' },
        });

        if (!currentSemester) {
          return res.status(HTTP_STATUS.NOT_FOUND).json({
            message: "Không tìm thấy học kỳ hiện tại"
          });
        }

        // Tìm group theo groupCode và semesterId
        group = await prisma.group.findFirst({
          where: { 
            groupCode: groupId,
            semesterId: currentSemester.id
          },
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


  async getMeetingsByMentor(req: AuthenticatedRequest, res: Response) {
    try {
      const mentorId = req.user!.userId;
      
      // Lấy semesterId từ query hoặc từ role của người dùng nếu không có trong query
      let semesterId = req.query.semesterId as string;
      
      // Nếu không có semesterId trong query, lấy học kỳ hiện tại
      if (!semesterId) {
        const currentSemester = await prisma.semester.findFirst({
          where: { status: 'ACTIVE' },
          orderBy: { startDate: 'desc' }
        });
        
        if (currentSemester) {
          semesterId = currentSemester.id;
        }
      }

      // Lấy danh sách meeting
      const meetings = await this.meetingService.getMeetingsByMentor(
        mentorId, 
        semesterId
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

  async getMainMentorMeetings(req: AuthenticatedRequest, res: Response) {
    try {
      const mentorId = req.user!.userId;
      
      // Lấy semesterId từ query hoặc từ role của người dùng nếu không có trong query
      let semesterId = req.query.semesterId as string;
      
      // Nếu không có semesterId trong query, lấy học kỳ hiện tại
      if (!semesterId) {
        const currentSemester = await prisma.semester.findFirst({
          where: { status: 'ACTIVE' },
          orderBy: { startDate: 'desc' }
        });
        
        if (currentSemester) {
          semesterId = currentSemester.id;
        }
      }

      // Lấy danh sách các nhóm mà lecturer là mentor chính
      const mentorGroups = await prisma.groupMentor.findMany({
        where: {
          mentorId,
          group: semesterId ? {
            semesterId: semesterId
          } : undefined,
          role: {
            name: 'mentor_main'
          }
        },
        select: {
          groupId: true
        }
      });

      if (mentorGroups.length === 0) {
        return res.status(HTTP_STATUS.OK).json({
          data: [],
        });
      }

      // Lấy danh sách groupId
      const groupIds = mentorGroups.map(group => group.groupId);

      // Lấy tất cả meeting của các nhóm này
      const meetings = await prisma.meetingSchedule.findMany({
        where: {
          groupId: {
            in: groupIds
          }
        },
        orderBy: {
          meetingTime: 'desc'
        }
      });

      // Lấy thông tin chi tiết cho mỗi meeting
      const meetingsWithDetails = await Promise.all(
        meetings.map(async (meeting) => {
          // Lấy thông tin mentor chính
          const mainMentor = await prisma.user.findUnique({
            where: { id: meeting.mentorId },
            select: {
              id: true,
              fullName: true,
              email: true,
              avatar: true
            }
          });

          // Lấy thông tin nhóm
          const group = await prisma.group.findUnique({
            where: { id: meeting.groupId },
            select: {
              id: true,
              groupCode: true,
              semesterId: true
            }
          });

          return {
            ...meeting,
            group,
            mentor: mainMentor,
            isMentorMain: meeting.mentorId === mentorId,
            role: 'main'
          };
        })
      );

      res.status(HTTP_STATUS.OK).json({
        data: meetingsWithDetails,
      });
    } catch (error) {
      console.error("Error getting main mentor meetings:", error);
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: (error as Error).message,
      });
    }
  }

 
  async getSubMentorMeetings(req: AuthenticatedRequest, res: Response) {
    try {
      const mentorId = req.user!.userId;
      
      // Lấy semesterId từ query hoặc từ role của người dùng nếu không có trong query
      let semesterId = req.query.semesterId as string;
      
      // Nếu không có semesterId trong query, lấy học kỳ hiện tại
      if (!semesterId) {
        const currentSemester = await prisma.semester.findFirst({
          where: { status: 'ACTIVE' },
          orderBy: { startDate: 'desc' }
        });
        
        if (currentSemester) {
          semesterId = currentSemester.id;
        }
      }

      // Lấy danh sách các nhóm mà lecturer là mentor phụ
      const mentorGroups = await prisma.groupMentor.findMany({
        where: {
          mentorId,
          group: semesterId ? {
            semesterId: semesterId
          } : undefined,
          role: {
            name: 'mentor_sub'
          }
        },
        select: {
          groupId: true
        }
      });

      if (mentorGroups.length === 0) {
        return res.status(HTTP_STATUS.OK).json({
          data: [],
        });
      }

      // Lấy danh sách groupId
      const groupIds = mentorGroups.map(group => group.groupId);

      // Lấy tất cả meeting của các nhóm này
      const meetings = await prisma.meetingSchedule.findMany({
        where: {
          groupId: {
            in: groupIds
          }
        },
        orderBy: {
          meetingTime: 'desc'
        }
      });

      // Lấy thông tin chi tiết cho mỗi meeting
      const meetingsWithDetails = await Promise.all(
        meetings.map(async (meeting) => {
          // Lấy thông tin mentor chính
          const mainMentor = await prisma.user.findUnique({
            where: { id: meeting.mentorId },
            select: {
              id: true,
              fullName: true,
              email: true,
              avatar: true
            }
          });

          // Lấy thông tin nhóm
          const group = await prisma.group.findUnique({
            where: { id: meeting.groupId },
            select: {
              id: true,
              groupCode: true,
              semesterId: true
            }
          });

          return {
            ...meeting,
            group,
            mentor: mainMentor,
            isMentorMain: false,
            role: 'sub'
          };
        })
      );

      res.status(HTTP_STATUS.OK).json({
        data: meetingsWithDetails,
      });
    } catch (error) {
      console.error("Error getting sub mentor meetings:", error);
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: (error as Error).message,
      });
    }
  }
}