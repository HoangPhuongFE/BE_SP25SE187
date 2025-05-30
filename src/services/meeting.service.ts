import { PrismaClient, MeetingSchedule } from '@prisma/client';
import { MEETING_MESSAGE } from '../constants/message';
import { nowVN } from '../utils/date'; 
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
  const group = await prisma.group.findUnique({
    where: { 
      id: data.groupId,
      isDeleted: false
    }
  });

  if (!group) {
    throw new Error(MEETING_MESSAGE.GROUP_NOT_FOUND);
  }

  const isMentor = await prisma.groupMentor.findFirst({
    where: { 
      groupId: data.groupId, 
      mentorId: data.mentorId,
      isDeleted: false
    }
  });
  
  if (!isMentor) {
    throw new Error(MEETING_MESSAGE.UNAUTHORIZED_MENTOR);
  }

  const meetingStartTime = new Date(data.meetingTime);
  const meetingEndTime = new Date(meetingStartTime.getTime() + 45 * 60 * 1000);

  const overlappingMeetings = await prisma.meetingSchedule.findMany({
    where: {
      groupId: data.groupId,
      isDeleted: false,
      OR: [
        {
          meetingTime: {
            lte: meetingStartTime,
          },
          AND: {
            meetingTime: {
              gte: new Date(meetingStartTime.getTime() - 45 * 60 * 1000),
            }
          }
        },
        {
          meetingTime: {
            gte: meetingStartTime,
            lte: meetingEndTime,
          }
        },
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

  const meetingData: any = {
    mentorId: data.mentorId,
    groupId: data.groupId,
    meetingTime: meetingStartTime,
    location: data.location || 'Online',
    agenda: data.agenda,
    status: 'SCHEDULED',
    createdAt: nowVN(), // Thêm: Rõ ràng gán createdAt bằng nowVN()
  };
  
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
  const existingMeeting = await prisma.meetingSchedule.findUnique({
    where: { id }
  });

  if (!existingMeeting) {
    throw new Error(MEETING_MESSAGE.MEETING_NOT_FOUND);
  }

  if (existingMeeting.mentorId !== mentorId) {
    throw new Error(MEETING_MESSAGE.UNAUTHORIZED_MENTOR);
  }

  const now = nowVN(); // Sửa: Dùng nowVN()
  const meetingTime = new Date(existingMeeting.meetingTime);
  const oneDayBefore = new Date(meetingTime.getTime() - 24 * 60 * 60 * 1000);

  if (now > oneDayBefore) {
    throw new Error(MEETING_MESSAGE.UPDATE_TIME_EXPIRED);
  }

  const updateData: any = {};
  
  if (data.meetingTime) updateData.meetingTime = new Date(data.meetingTime);
  if (data.location !== undefined) updateData.location = data.location || 'Online';
  if (data.agenda) updateData.agenda = data.agenda;
  if (data.meetingNotes) updateData.meetingNotes = data.meetingNotes;
  if (data.status) updateData.status = data.status;
  if (data.url !== undefined) updateData.url = data.url;
  updateData.updatedAt = nowVN(); // Thêm: Rõ ràng gán updatedAt bằng nowVN()

  return await prisma.meetingSchedule.update({
    where: { id },
    data: updateData
  });
}

async deleteMeeting(meetingId: string, userId: string, ipAddress?: string): Promise<{ message: string; data: any }> {
  try {
    const meeting = await prisma.meetingSchedule.findUnique({
      where: { id: meetingId, isDeleted: false },
      select: {
        id: true,
        mentorId: true,
        meetingTime: true,
        location: true,
        status: true,
        groupId: true,
      },
    });

    if (!meeting) {
      await prisma.systemLog.create({
        data: {
          userId,
          action: 'DELETE_MEETING_ATTEMPT',
          entityType: 'MeetingSchedule',
          entityId: meetingId,
          description: 'Thử xóa cuộc họp nhưng không tìm thấy hoặc đã bị đánh dấu xóa',
          severity: 'WARNING',
          ipAddress: ipAddress || 'unknown',
          createdAt: nowVN(),
        },
      });
      throw new Error('Cuộc họp không tồn tại hoặc đã bị xóa');
    }

    if (meeting.mentorId !== userId) {
      await prisma.systemLog.create({
        data: {
          userId,
          action: 'DELETE_MEETING_ATTEMPT',
          entityType: 'MeetingSchedule',
          entityId: meetingId,
          description: 'Thử xóa cuộc họp nhưng không phải mentor được phân công',
          severity: 'WARNING',
          ipAddress: ipAddress || 'unknown',
          metadata: { userId, meetingMentorId: meeting.mentorId },
          createdAt: nowVN(),
        },
      });
      throw new Error('Chỉ mentor được phân công mới có quyền xóa cuộc họp');
    }

    const now = nowVN();
    const meetingTime = new Date(meeting.meetingTime);
    const oneDayBefore = new Date(meetingTime.getTime() - 24 * 60 * 60 * 1000);
    if (now > oneDayBefore) {
      await prisma.systemLog.create({
        data: {
          userId,
          action: 'DELETE_MEETING_ATTEMPT',
          entityType: 'MeetingSchedule',
          entityId: meetingId,
          description: 'Thử xóa cuộc họp nhưng đã quá thời hạn cho phép (trước 24h)',
          severity: 'WARNING',
          ipAddress: ipAddress || 'unknown',
          metadata: { currentTime: now.toISOString(), oneDayBefore: oneDayBefore.toISOString() },
          createdAt: nowVN(),
        },
      });
      throw new Error('Chỉ có thể xóa cuộc họp trước 24 giờ');
    }

    if (meeting.status === 'completed') {
      await prisma.systemLog.create({
        data: {
          userId,
          action: 'DELETE_MEETING_ATTEMPT',
          entityType: 'MeetingSchedule',
          entityId: meetingId,
          description: 'Thử xóa cuộc họp nhưng cuộc họp đã diễn ra',
          severity: 'WARNING',
          ipAddress: ipAddress || 'unknown',
          metadata: { currentStatus: meeting.status },
          createdAt: nowVN(),
        },
      });
      throw new Error('Không thể xóa cuộc họp đã diễn ra');
    }

    const [updatedFeedbacks, updatedMeeting] = await prisma.$transaction([
      prisma.feedback.updateMany({
        where: { meetingId, isDeleted: false },
        data: { isDeleted: true },
      }),
      // Bỏ phần xóa mềm Document vì không có quan hệ với MeetingSchedule trong schema
      prisma.meetingSchedule.update({
        where: { id: meetingId },
        data: { isDeleted: true },
      }),
    ]);

    await prisma.systemLog.create({
      data: {
        userId,
        action: 'DELETE_MEETING',
        entityType: 'MeetingSchedule',
        entityId: meetingId,
        description: `Cuộc họp tại "${meeting.location}" vào ${meeting.meetingTime.toISOString()} đã được đánh dấu xóa`,
        severity: 'INFO',
        ipAddress: ipAddress || 'unknown',
        metadata: {
          meetingTime: meeting.meetingTime.toISOString(),
          location: meeting.location,
          groupId: meeting.groupId,
          updatedFeedbacks: updatedFeedbacks.count,
        },
        oldValues: JSON.stringify(meeting),
        createdAt: nowVN(),
      },
    });

    return { message: 'Xóa cuộc họp thành công', data: updatedMeeting };
  } catch (error) {
    await prisma.systemLog.create({
      data: {
        userId,
        action: 'DELETE_MEETING_ERROR',
        entityType: 'MeetingSchedule',
        entityId: meetingId,
        description: 'Lỗi hệ thống khi đánh dấu xóa cuộc họp',
        severity: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
        stackTrace: (error as Error).stack || 'No stack trace',
        ipAddress: ipAddress || 'unknown',
        createdAt: nowVN(),
      },
    });
    throw error;
  }
}











  async getMeetingsByGroup(groupId: string): Promise<any[]> {
    // Kiểm tra group có tồn tại không
    const group = await prisma.group.findUnique({
      where: { 
        id: groupId,
        isDeleted: false
      }
    });

    if (!group) {
      throw new Error(MEETING_MESSAGE.GROUP_NOT_FOUND);
    }

    // Lấy danh sách meeting của group
    const meetings = await prisma.meetingSchedule.findMany({
      where: { 
        groupId: groupId,
        isDeleted: false
      },
      orderBy: {
        meetingTime: 'desc'
      }
    });

    // Lấy thông tin mentor cho mỗi meeting
    const meetingsWithMentorInfo = await Promise.all(
      meetings.map(async (meeting) => {
        const mentor = await prisma.user.findUnique({
          where: { 
            id: meeting.mentorId,
            isDeleted: false
          },
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