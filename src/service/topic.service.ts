import { PrismaClient } from '@prisma/client';
import { TOPIC_MESSAGE } from '../constants/message';
import { validate as isUUID } from 'uuid';




const prisma = new PrismaClient();

export class TopicService {
  private async generateTopicCode(semesterId: string, majorId: string): Promise<string> {
    // Lấy thông tin học kỳ và năm
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
      include: {
        year: true
      }
    });

    if (!semester) {
      throw new Error('Học kỳ không tồn tại');
    }

    // Lấy thông tin ngành
    const major = await prisma.major.findUnique({
      where: { id: majorId }
    });

    if (!major) {
      throw new Error('Ngành học không tồn tại');
    }

    // Xác định prefix học kỳ (SP: Spring, SU: Summer, FA: Fall)
    const semesterPrefix = semester.code.startsWith('Spring') ? 'SP' : 
                          semester.code.startsWith('Summer') ? 'SU' : 'FA';
    
    // Lấy 2 số cuối của năm
    const yearSuffix = semester.year.year.toString().slice(-2);
    
    // Lấy mã ngành (SE, IA, etc.)
    const majorCode = major.name;


    // Đếm số đề tài trong học kỳ này
    const topicCount = await prisma.topic.count({
      where: {
        semesterId: semester.id
      }
    });

    // Tạo số thứ tự 3 chữ số
    const sequenceNumber = (topicCount + 1).toString().padStart(3, '0');

    // Kết hợp thành mã đề tài
    return `${semesterPrefix}${yearSuffix}${majorCode}${sequenceNumber}`;
  }

  async createTopic(data: {
    topicCode: string;
    name: string;
    description: string;
    maxStudents: number;
    semesterId: string;
    majors: string[];
    createdBy: string;
    isBusiness?: boolean;
    businessPartner?: string;
  }) {
    if (!isUUID(data.semesterId)) {
      throw new Error('ID semester is not valid');
    }


    for (const majorId of data.majors) {
      if (!isUUID(majorId)) {
        throw new Error('ID major is not valid');
      }
    }

    const topic = await prisma.topic.create({
      data: {
        topicCode: data.topicCode,
        name: data.name,
        description: data.description,
        isBusiness: data.isBusiness || false,
        businessPartner: data.businessPartner,
        status: 'PENDING',
        createdBy: data.createdBy,
        semesterId: data.semesterId,
        detailMajorTopics: {
          create: data.majors.map(majorId => ({
            majorId,
            status: 'ACTIVE'
          }))
        }
      },
      include: {
        detailMajorTopics: {
          include: {
            major: true
          }
        }
      }
    });

    return topic;
  }

  async updateTopic(id: string, data: any) {
    if (!isUUID(id)) {
      throw new Error('ID topic is not valid');
    }

    if (data.majors) {
      for (const majorId of data.majors) {
        if (!isUUID(majorId)) {
          throw new Error('ID major is not valid');
        }
      }
    }

    const topic = await prisma.topic.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        isBusiness: data.isBusiness,
        businessPartner: data.businessPartner,
        status: data.status,
        updatedAt: new Date(),
        detailMajorTopics: data.majors ? {
          deleteMany: {},
          create: data.majors.map((majorId: string) => ({
            majorId,
            status: 'ACTIVE'
          }))
        } : undefined
      },
      include: {
        detailMajorTopics: {
          include: {
            major: true
          }
        }
      }
    });

    return topic;
  }

  async deleteTopic(id: string) {
    if (!isUUID(id)) {
      throw new Error('ID topic is not valid');
    }

    await prisma.topic.delete({
      where: { id }
    });
  }

  async updateTopicRegistration(
    registrationId: string,
    status: string,
    reviewerId?: string
  ) {
    if (!isUUID(registrationId)) {
      throw new Error('ID registration is not valid');
    }

    if (reviewerId && !isUUID(reviewerId)) {
      throw new Error('ID reviewer is not valid');
    }

    const registration = await prisma.topicRegistration.update({
      where: { id: registrationId },
      data: {
        status,
        reviewerId,
        reviewedAt: new Date()
      }
    });

    return registration;
  }

  async registerTopic(data: {
    name: string;
    description: string;
    userId: string;
    semesterId: string;
    majorId: string;
  }) {
    const { name, description, userId, semesterId, majorId } = data;

    // Kiểm tra user và role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    });

    if (!user) {
      throw new Error('Người dùng không tồn tại');
    }

    // Kiểm tra role của user
    const userRoles = user.roles.map(ur => ur.role.name);
    let role: string;

    if (userRoles.includes('mentor')) {
      role = 'mentor';
    } else if (userRoles.includes('leader')) {
      role = 'leader';
    } else {
      throw new Error('Người dùng không có quyền đăng ký đề tài');
    }

    // Tạo mã đề tài tự động
    const topicCode = await this.generateTopicCode(semesterId, majorId);

    // Tạo topic và registration
    const topic = await prisma.topic.create({
      data: {
        topicCode,
        name,
        description,
        status: 'PENDING',
        isBusiness: false,
        semesterId,
        createdBy: userId,
        detailMajorTopics: {
          create: [{
            majorId,
            status: 'ACTIVE'
          }]
        }
      }
    });

    const registration = await prisma.topicRegistration.create({
      data: {
        role,
        status: 'pending',
        userId,
        topicId: topic.id
      }
    });

    return {
      ...registration,
      topic,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName
      }
    };
  }
} 