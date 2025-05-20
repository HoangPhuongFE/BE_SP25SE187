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
  
    await prisma.majorPairConfig.update({
      where: { id: configId },
      data: { isDeleted: true, isActive: false },
    });
  
    return {
      success: true,
      status: HTTP_STATUS.OK,
      message: 'Xóa mềm cấu hình liên ngành thành công!',
    };
  }
  
}
