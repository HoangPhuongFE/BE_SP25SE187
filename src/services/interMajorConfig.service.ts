import { PrismaClient } from '@prisma/client';
import HTTP_STATUS from '../constants/httpStatus';

const prisma = new PrismaClient();

export interface InterMajorConfigDTO {
  name: string;
  firstMajorId: string;
  secondMajorId: string;
  semesterId: string;
}

export class InterMajorConfigService {
 
  
  
  async createConfig(data: InterMajorConfigDTO) {
    const { name, firstMajorId, secondMajorId, semesterId } = data;
  
    if (!firstMajorId || !secondMajorId || !semesterId) {
      return {
        success: false,
        status: HTTP_STATUS.BAD_REQUEST,
        message: 'Thiếu firstMajorId, secondMajorId hoặc semesterId!',
      };
    }
  
    if (firstMajorId === secondMajorId) {
      return {
        success: false,
        status: HTTP_STATUS.BAD_REQUEST,
        message: 'Hai ngành không được trùng nhau!',
      };
    }
  
    // Chỉ kiểm tra bản ghi chưa xóa
    const exists = await prisma.majorPairConfig.findFirst({
      where: {
        semesterId,
        firstMajorId,
        secondMajorId,
        isDeleted: false,
      },
    });
  
    if (exists) {
      return {
        success: false,
        status: HTTP_STATUS.CONFLICT,
        message: 'Cấu hình liên ngành đã tồn tại cho học kỳ này!',
      };
    }
  
    try {
      const config = await prisma.majorPairConfig.create({
        data: {
          name,
          firstMajorId,
          secondMajorId,
          semesterId,
          isActive: true,
          isDeleted: false,
        },
      });
  
      return {
        success: true,
        status: HTTP_STATUS.CREATED,
        message: 'Tạo cấu hình liên ngành thành công!',
        data: config,
      };
    } catch (error) {
      console.error('Lỗi khi tạo cấu hình liên ngành:', error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Đã xảy ra lỗi khi tạo cấu hình liên ngành!',
      };
    }
  }
  
  async getAllConfigs(semesterId?: string) {
    // Nếu không có semesterId, trả về tất cả cấu hình (cho student)
    if (!semesterId) {
      const configs = await prisma.majorPairConfig.findMany({
        where: {
          isActive: true,
          isDeleted: false,
        },
        include: {
          firstMajor: { select: { id: true, name: true } },
          secondMajor: { select: { id: true, name: true } },
        },
      });
      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: 'Lấy danh sách cấu hình liên ngành thành công!',
        data: configs,
      };
    }
  
    // Nếu có semesterId, lọc cấu hình theo học kỳ
    const configs = await prisma.majorPairConfig.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        semesterId: semesterId, // Giả sử majorPairConfig có trường semesterId
      },
      include: {
        firstMajor: { select: { id: true, name: true } },
        secondMajor: { select: { id: true, name: true } },
      },
    });
  
    return {
      success: true,
      status: HTTP_STATUS.OK,
      message: 'Lấy danh sách cấu hình liên ngành thành công!',
      data: configs,
    };
  }
  

  async getConfigById(configId: string) {
    if (!configId) {
      return {
        success: false,
        status: HTTP_STATUS.BAD_REQUEST,
        message: 'Thiếu configId!',
      };
    }
    const config = await prisma.majorPairConfig.findFirst({
      where: {
        id: configId,
        isDeleted: false,
      },
      include: {
        firstMajor: { select: { id: true, name: true } },
        secondMajor: { select: { id: true, name: true } },
      },
    });
  
    if (!config) {
      return {
        success: false,
        status: HTTP_STATUS.NOT_FOUND,
        message: 'Không tìm thấy cấu hình liên ngành!',
      };
    }
  
    return {
      success: true,
      status: HTTP_STATUS.OK,
      message: 'Lấy chi tiết cấu hình liên ngành thành công!',
      data: config,
    };
  }
  

  async updateConfig(configId: string, data: { name?: string, isActive?: boolean }) {
    if (!configId) {
      return {
        success: false,
        status: HTTP_STATUS.BAD_REQUEST,
        message: 'Thiếu configId!',
      };
    }
  
    const existingConfig = await prisma.majorPairConfig.findFirst({
      where: { id: configId, isDeleted: false },
    });
  
    if (!existingConfig) {
      return {
        success: false,
        status: HTTP_STATUS.NOT_FOUND,
        message: 'Không tìm thấy cấu hình liên ngành!',
      };
    }
  
    const updatedConfig = await prisma.majorPairConfig.update({
      where: { id: configId },
      data,
    });
  
    return {
      success: true,
      status: HTTP_STATUS.OK,
      message: 'Cập nhật cấu hình liên ngành thành công!',
      data: updatedConfig,
    };
  }
  

  async deleteConfig(configId: string) {
  if (!configId) {
    return {
      success: false,
      status: HTTP_STATUS.BAD_REQUEST,
      message: 'Thiếu configId!',
    };
  }

  // Kiểm tra cấu hình tồn tại
  const existingConfig = await prisma.majorPairConfig.findFirst({
    where: { id: configId, isDeleted: false },
  });

  if (!existingConfig) {
    return {
      success: false,
      status: HTTP_STATUS.NOT_FOUND,
      message: 'Không tìm thấy cấu hình liên ngành!',
    };
  }

  try {
    // Thực hiện xóa mềm trong một transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Tìm tất cả các nhóm liên quan đến cấu hình
      const groups = await tx.group.findMany({
        where: { majorPairConfigId: configId, isDeleted: false },
        select: { id: true },
      });

      const groupIds = groups.map((g) => g.id);

      // 2. Tìm tất cả đề tài liên quan đến cấu hình
      const topics = await tx.topic.findMany({
        where: { majorPairConfigId: configId, isDeleted: false },
        select: { id: true },
      });

      const topicIds = topics.map((t) => t.id);

      // 3. Xóa mềm các dữ liệu liên quan đến nhóm
      if (groupIds.length > 0) {
        // Xóa mềm lịch xét duyệt (ReviewSchedule)
        await tx.reviewSchedule.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        });

        // Xóa mềm lịch bảo vệ (DefenseSchedule)
        const defenseSchedules = await tx.defenseSchedule.findMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          select: { id: true },
        });
        const defenseScheduleIds = defenseSchedules.map((ds) => ds.id);

        await tx.defenseSchedule.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        });

        // Xóa mềm kết quả bảo vệ (DefenseMemberResult)
        await tx.defenseMemberResult.updateMany({
          where: { defenseScheduleId: { in: defenseScheduleIds }, isDeleted: false },
          data: { isDeleted: true },
        });

        // Xóa mềm báo cáo tiến độ (ProgressReport)
        await tx.progressReport.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        });

        // Xóa mềm lịch họp (MeetingSchedule)
        const meetingSchedules = await tx.meetingSchedule.findMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          select: { id: true },
        });
        const meetingScheduleIds = meetingSchedules.map((ms) => ms.id);

        await tx.meetingSchedule.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        });

        // Xóa mềm phản hồi (Feedback)
        await tx.feedback.updateMany({
          where: { meetingId: { in: meetingScheduleIds }, isDeleted: false },
          data: { isDeleted: true },
        });

        // Xóa mềm nhóm mentor (GroupMentor)
        await tx.groupMentor.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        });

        // Xóa mềm thành viên nhóm (GroupMember)
        await tx.groupMember.updateMany({
          where: { groupId: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        });

        // Xóa mềm nhóm (Group)
        await tx.group.updateMany({
          where: { id: { in: groupIds }, isDeleted: false },
          data: { isDeleted: true },
        });
      }

      // 4. Xóa mềm các dữ liệu liên quan đến đề tài
      if (topicIds.length > 0) {
        // Xóa mềm phân công đề tài (TopicAssignment)
        await tx.topicAssignment.updateMany({
          where: { topicId: { in: topicIds }, isDeleted: false },
          data: { isDeleted: true },
        });

        // Xóa mềm tài liệu (Document)
        await tx.document.updateMany({
          where: { topicId: { in: topicIds }, isDeleted: false },
          data: { isDeleted: true },
        });

        // Xóa mềm đề tài (Topic)
        await tx.topic.updateMany({
          where: { id: { in: topicIds }, isDeleted: false },
          data: { isDeleted: true },
        });
      }

      // 5. Xóa mềm cấu hình liên ngành (MajorPairConfig)
      await tx.majorPairConfig.update({
        where: { id: configId },
        data: { isDeleted: true, isActive: false },
      });

      return { success: true };
    });

    if (result.success) {
      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: 'Xóa mềm cấu hình liên ngành và các dữ liệu liên quan thành công!',
      };
    }

    return {
      success: false,
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: 'Lỗi trong quá trình xóa mềm cấu hình liên ngành!',
    };
  } catch (error) {
    console.error('Lỗi khi xóa mềm cấu hình liên ngành:', error);
    return {
      success: false,
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: 'Lỗi hệ thống khi xóa mềm cấu hình liên ngành!',
    };
  }
}
  
}
