import { PrismaClient, MeetingSchedule } from '@prisma/client';
import { MEETING_MESSAGE } from '../constants/message';

const prisma = new PrismaClient();

interface CreateMeetingDto {
  mentorId: string;
  groupId: string;
  meetingTime: Date;
  location: string;
  agenda: string;
  url?: string;
}

interface UpdateMeetingDto {
  meetingTime?: Date;
  location?: string;
  agenda?: string;
  meetingNotes?: string;
  status?: string;
  url?: string;
}

export class MeetingService {
  async createMeeting(data: CreateMeetingDto): Promise<MeetingSchedule> {
    // Kiểm tra group có tồn tại không
    const group = await prisma.group.findUnique({
      where: { id: data.groupId }
    });

    if (!group) {
      throw new Error(MEETING_MESSAGE.GROUP_NOT_FOUND);
    }

    // Kiểm tra người tạo có phải là mentor của group không
    const isMentor = await prisma.groupMentor.findFirst({
      where: { groupId: data.groupId, mentorId: data.mentorId }
    });
    
    if (!isMentor) {
      throw new Error(MEETING_MESSAGE.UNAUTHORIZED_MENTOR);
    }

    // Tính toán thời gian kết thúc
    const meetingStartTime = new Date(data.meetingTime);
    const meetingEndTime = new Date(meetingStartTime.getTime() + 45 * 60 * 1000); // 45 phút sau

    // Kiểm tra xem có cuộc họp nào khác trong khoảng thời gian này không
    const overlappingMeetings = await prisma.meetingSchedule.findMany({
      where: {
        groupId: data.groupId,
        OR: [
          // Kiểm tra cuộc họp mới bắt đầu trong khoảng thời gian của cuộc họp đã tồn tại
          {
            meetingTime: {
              lte: meetingStartTime,
            },
            AND: {
              meetingTime: {
                gte: new Date(meetingStartTime.getTime() - 45 * 60 * 1000), // 45 phút trước thời gian bắt đầu
              }
            }
          },
          // Kiểm tra cuộc họp mới kết thúc trong khoảng thời gian của cuộc họp đã tồn tại
          {
            meetingTime: {
              gte: meetingStartTime,
              lte: meetingEndTime,
            }
          },
          // Kiểm tra cuộc họp mới bao trùm cuộc họp đã tồn tại
          {
            meetingTime: {
              gte: new Date(meetingStartTime.getTime() - 45 * 60 * 1000),
              lte: new Date(meetingEndTime.getTime() + 45 * 60 * 1000),
            }
          }
        ]
      }
    });

    if (overlappingMeetings.length > 0) {
      throw new Error("Cuộc họp đã tồn tại trong khoảng thời gian này hoặc cách thời gian quá gần (dưới 45 phút).");
    }

    // Tạo meeting mới với các trường cơ bản
    const meetingData: any = {
      mentorId: data.mentorId,
      groupId: data.groupId, // Sử dụng UUID trực tiếp
      meetingTime: meetingStartTime,
      location: data.location,
      agenda: data.agenda,
      status: 'SCHEDULED',
    };
    
    // Thêm url nếu có
    if (data.url) {
      meetingData.url = data.url;
    }

    try {
      return await prisma.meetingSchedule.create({
        data: meetingData
      });
    } catch (error) {
      console.error("Error creating meeting:", error);
      throw new Error(`Không thể tạo cuộc họp: ${error as Error}.message`);
    }
  }

  async updateMeeting(id: string, mentorId: string, data: UpdateMeetingDto): Promise<MeetingSchedule> {
    // Kiểm tra meeting có tồn tại không
    const existingMeeting = await prisma.meetingSchedule.findUnique({
      where: { id }
    });

    if (!existingMeeting) {
      throw new Error(MEETING_MESSAGE.MEETING_NOT_FOUND);
    }

    // Kiểm tra người cập nhật có phải là người tạo meeting không
    if (existingMeeting.mentorId !== mentorId) {
      throw new Error(MEETING_MESSAGE.UNAUTHORIZED_MENTOR);
    }

    // Kiểm tra thời gian cập nhật meeting
    const now = new Date();
    const meetingTime = new Date(existingMeeting.meetingTime);
    const oneDayBefore = new Date(meetingTime.getTime() - 24 * 60 * 60 * 1000);

    if (now > oneDayBefore) {
      throw new Error(MEETING_MESSAGE.UPDATE_TIME_EXPIRED);
    }

    // Chuẩn bị dữ liệu cập nhật
    const updateData: any = {};
    
    // Nếu có cập nhật thời gian, kiểm tra trùng lặp
    if (data.meetingTime) {
      const newMeetingTime = new Date(data.meetingTime);
      const newMeetingEndTime = new Date(newMeetingTime.getTime() + 45 * 60 * 1000); // 45 phút sau
      
      // Kiểm tra xem có cuộc họp nào khác trong khoảng thời gian này không (trừ cuộc họp hiện tại)
      const overlappingMeetings = await prisma.meetingSchedule.findMany({
        where: {
          groupId: existingMeeting.groupId,
          id: { not: id }, // Loại trừ cuộc họp hiện tại
          OR: [
            // Kiểm tra cuộc họp mới bắt đầu trong khoảng thời gian của cuộc họp đã tồn tại
            {
              meetingTime: {
                lte: newMeetingTime,
              },
              AND: {
                meetingTime: {
                  gte: new Date(newMeetingTime.getTime() - 45 * 60 * 1000), // 45 phút trước thời gian bắt đầu
                }
              }
            },
            // Kiểm tra cuộc họp mới kết thúc trong khoảng thời gian của cuộc họp đã tồn tại
            {
              meetingTime: {
                gte: newMeetingTime,
                lte: newMeetingEndTime,
              }
            },
            // Kiểm tra cuộc họp mới bao trùm cuộc họp đã tồn tại
            {
              meetingTime: {
                gte: new Date(newMeetingTime.getTime() - 45 * 60 * 1000),
                lte: new Date(newMeetingEndTime.getTime() + 45 * 60 * 1000),
              }
            }
          ]
        }
      });

      if (overlappingMeetings.length > 0) {
        throw new Error("Thời gian mới trùng với cuộc họp khác hoặc cách thời gian quá gần (dưới 45 phút).");
      }
      
      updateData.meetingTime = newMeetingTime;
    }
    
    if (data.location) updateData.location = data.location;
    if (data.agenda) updateData.agenda = data.agenda;
    if (data.meetingNotes) updateData.meetingNotes = data.meetingNotes;
    if (data.status) updateData.status = data.status;
    if (data.url !== undefined) updateData.url = data.url;

    // Cập nhật meeting
    return await prisma.meetingSchedule.update({
      where: { id },
      data: updateData
    });
  }

  async deleteMeeting(id: string, mentorId: string): Promise<void> {
    // Kiểm tra meeting có tồn tại không
    const meeting = await prisma.meetingSchedule.findUnique({
      where: { id }
    });

    if (!meeting) {
      throw new Error(MEETING_MESSAGE.MEETING_NOT_FOUND);
    }

    // Kiểm tra người xóa có phải là người tạo meeting không
    if (meeting.mentorId !== mentorId) {
      throw new Error(MEETING_MESSAGE.UNAUTHORIZED_MENTOR);
    }

    // Kiểm tra thời gian xóa meeting
    const now = new Date();
    const meetingTime = new Date(meeting.meetingTime);
    const oneDayBefore = new Date(meetingTime.getTime() - 24 * 60 * 60 * 1000);

    if (now > oneDayBefore) {
      throw new Error(MEETING_MESSAGE.DELETE_TIME_EXPIRED);
    }

    // Xóa meeting
    await prisma.meetingSchedule.delete({
      where: { id }
    });
  }

  async getMeetingsByGroup(groupId: string): Promise<any[]> {
    // Kiểm tra group có tồn tại không
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      throw new Error(MEETING_MESSAGE.GROUP_NOT_FOUND);
    }

    // Lấy danh sách meeting của group
    const meetings = await prisma.meetingSchedule.findMany({
      where: { 
        groupId: groupId
      },
      orderBy: {
        meetingTime: 'desc'
      }
    });

    // Lấy thông tin mentor cho mỗi meeting
    const meetingsWithMentorInfo = await Promise.all(
      meetings.map(async (meeting) => {
        const mentor = await prisma.user.findUnique({
          where: { id: meeting.mentorId },
          select: {
            id: true,
            fullName: true,
            email: true,
            avatar: true
          }
        });

        return {
          ...meeting,
          mentor
        };
      })
    );

    return meetingsWithMentorInfo;
  }

  async getMeetingById(id: string): Promise<any> {
    // Lấy thông tin chi tiết của meeting
    const meeting = await prisma.meetingSchedule.findUnique({
      where: { id }
    });

    if (!meeting) {
      throw new Error(MEETING_MESSAGE.MEETING_NOT_FOUND);
    }

    // Lấy thông tin mentor chính
    const mentor = await prisma.user.findUnique({
      where: { id: meeting.mentorId },
      select: {
        id: true,
        fullName: true,
        email: true,
        avatar: true
      }
    });

    // Lấy thông tin các mentor khác của group
    const groupMentors = await prisma.groupMentor.findMany({
      where: { 
        groupId: meeting.groupId,
        mentorId: { not: meeting.mentorId }
      }
    });

    // Lấy thông tin chi tiết của các mentor phụ
    const subMentors = await Promise.all(
      groupMentors.map(async (gm) => {
        return await prisma.user.findUnique({
          where: { id: gm.mentorId },
          select: {
            id: true,
            fullName: true,
            email: true,
            avatar: true
          }
        });
      })
    );

    // Trả về meeting với thông tin bổ sung
    return {
      ...meeting,
      mentor,
      subMentors: subMentors.filter(Boolean) // Lọc bỏ các giá trị null
    };
  }

  /**
   * Lấy tất cả meeting của một mentor (cả mentor chính và mentor phụ)
   */
  async getMeetingsByMentor(mentorId: string, semesterId?: string): Promise<any[]> {
    // Lấy học kỳ hiện tại nếu không có semesterId được cung cấp
    if (!semesterId) {
      const currentSemester = await prisma.semester.findFirst({
        where: {
          status: 'ACTIVE'
        },
        orderBy: {
          startDate: 'desc'
        }
      });
      
      if (currentSemester) {
        semesterId = currentSemester.id;
      }
    }

    // Lấy danh sách các nhóm mà mentor là mentor chính hoặc mentor phụ
    const mentorGroups = await prisma.groupMentor.findMany({
      where: {
        mentorId,
        group: semesterId ? {
          semesterId: semesterId
        } : undefined
      },
      select: {
        groupId: true
      }
    });

    if (mentorGroups.length === 0) {
      return [];
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

        // Lấy thông tin các mentor khác của group
        const groupMentors = await prisma.groupMentor.findMany({
          where: { 
            groupId: meeting.groupId,
            mentorId: { not: meeting.mentorId }
          }
        });

        // Lấy thông tin chi tiết của các mentor phụ
        const subMentors = await Promise.all(
          groupMentors.map(async (gm) => {
            return await prisma.user.findUnique({
              where: { id: gm.mentorId },
              select: {
                id: true,
                fullName: true,
                email: true,
                avatar: true
              }
            });
          })
        );

        // Xác định vai trò của mentor trong meeting này
        const isMentorMain = meeting.mentorId === mentorId;

        return {
          ...meeting,
          group,
          mentor: mainMentor,
          subMentors: subMentors.filter(Boolean),
          isMentorMain, // Thêm trường để biết mentor là chính hay phụ
          role: isMentorMain ? 'main' : 'sub'
        };
      })
    );

    return meetingsWithDetails;
  }
} 