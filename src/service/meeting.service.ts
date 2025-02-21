import { PrismaClient, MeetingSchedule } from '@prisma/client';
import { MEETING_MESSAGE } from '../constants/message';

const prisma = new PrismaClient();

interface CreateMeetingDto {
  mentorId: string;
  groupId: string;
  meetingTime: Date;
  location: string;
  agenda: string;
}

interface UpdateMeetingDto {
  meetingTime?: Date;
  location?: string;
  agenda?: string;
  meetingNotes?: string;
  status?: string;
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
    

    // Tạo meeting mới
    return await prisma.meetingSchedule.create({
      data: {
        mentorId: data.mentorId,
        groupId: parseInt(data.groupId),
        meetingTime: new Date(data.meetingTime),
        location: data.location,
        agenda: data.agenda,
        status: 'SCHEDULED' 
      }
    });
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

    // Cập nhật meeting
    return await prisma.meetingSchedule.update({
      where: { id },
      data: {
        ...(data.meetingTime && { meetingTime: new Date(data.meetingTime) }),
        ...(data.location && { location: data.location }),
        ...(data.agenda && { agenda: data.agenda }),
        ...(data.meetingNotes && { meetingNotes: data.meetingNotes }),
        ...(data.status && { status: data.status })
      }
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

  async getMeetingsByGroup(groupId: string): Promise<MeetingSchedule[]> {
    // Kiểm tra group có tồn tại không
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      throw new Error(MEETING_MESSAGE.GROUP_NOT_FOUND);
    }

    // Lấy danh sách meeting của group
    return await prisma.meetingSchedule.findMany({
      where: { 
        groupId: Number(groupId)  
      },
      orderBy: {
        meetingTime: 'desc'
      }
    });
    
  }
} 