import { PrismaClient } from '@prisma/client';
import { TOPIC_MESSAGE } from '../constants/message';
import { validate as isUUID } from 'uuid';




const prisma = new PrismaClient();

export class TopicService {
  private async generateTopicCode(semesterId: string, majorId: string): Promise<string> {
    const [semester, major] = await Promise.all([
      prisma.semester.findUnique({
        where: { id: semesterId },
        include: { year: true }
      }),
      prisma.major.findUnique({
        where: { id: majorId }
      })
    ]);

    if (!semester) throw new Error('Semester not found');
    if (!major) throw new Error('Major not found');


    const semesterPrefix = {
      'Spring': 'SP',
      'Summer': 'SU',
      'Fall': 'FA'
    }[semester.code.split(' ')[0]] || 'FA';

    const yearSuffix = semester.year.year.toString().slice(-2);
    const topicCount = await prisma.topic.count({
      where: { semesterId: semester.id }
    });

    return `${semesterPrefix}${yearSuffix}${major.name}${(topicCount + 1).toString().padStart(3, '0')}`;
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

  async updateTopic(id: string, data: any, userId: string) {
    if (!isUUID(id)) {
      throw new Error('ID topic is not valid');
    }


    // Kiểm tra topic tồn tại
    const topic = await prisma.topic.findUnique({
      where: { id },
      include: {
        topicRegistrations: {
          where: { userId }
        }
      }
    });

    if (!topic) {
      throw new Error(TOPIC_MESSAGE.TOPIC_NOT_FOUND);
    }

    // Kiểm tra quyền update
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } }
    });

    const userRoles = user?.roles.map(ur => ur.role.name);

    if (userRoles?.includes('mentor')) {
      // Kiểm tra số lượng topic đã đăng ký của mentor
      const registeredCount = await prisma.topicRegistration.count({
        where: { 
          userId,
          role: 'mentor',
          status: 'approved'
        }
      });

      if (registeredCount >= 5 && !topic.topicRegistrations.length) {
        throw new Error(TOPIC_MESSAGE.MENTOR_MAX_TOPICS_REACHED);
      }
    } else if (userRoles?.includes('student')) {
      // Sinh viên chỉ được update khi topic bị reject
      const registration = topic.topicRegistrations[0];
      if (!registration || registration.status !== 'rejected') {
        throw new Error(TOPIC_MESSAGE.STUDENT_CANNOT_UPDATE);
      }
    } else {
      throw new Error(TOPIC_MESSAGE.UNAUTHORIZED_UPDATE);
    }

    // Thực hiện update
    return prisma.topic.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
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
  ): Promise<any> {
    if (!isUUID(registrationId)) {
      throw new Error('ID registration is not valid');
    }

    // Kiểm tra tồn tại của registration
    const registration = await prisma.topicRegistration.findUnique({
      where: { id: registrationId }
    });

    if (!registration) {
      throw new Error('Topic registration not found');
    }

    // Kiểm tra reviewer nếu có
    if (reviewerId) {
      if (!isUUID(reviewerId)) {
        throw new Error('ID reviewer is not valid');
      }

      const reviewer = await prisma.user.findUnique({
        where: { id: reviewerId }
      });

      if (!reviewer) {
        throw new Error('Reviewer not found');
      }
    }

    // Sử dụng transaction
    return prisma.$transaction(async (tx) => {
      const updatedRegistration = await tx.topicRegistration.update({
        where: { id: registrationId },
        data: {
          status,
          reviewerId,
          reviewedAt: new Date()
        }
      });

      // Cập nhật trạng thái topic nếu cần
      if (status === 'approved') {
        await tx.topic.update({
          where: { id: registration.topicId },
          data: { status: 'APPROVED' }
        });
      }

      return updatedRegistration;
    });
  }

  async registerTopic(data: {
    name: string;
    description: string;
    userId: string;
    semesterId: string;
    majorId: string;
  }) {
    const { name, description, userId, semesterId, majorId } = data;

    // Kiểm tra UUID cho tất cả các ID
    if (!isUUID(userId)) {
      throw new Error('ID user is not valid');
    }


    if (!isUUID(semesterId)) {
      throw new Error('ID semester is not valid');
    }


    if (!isUUID(majorId)) {
      throw new Error('ID major is not valid');
    }


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
      throw new Error('User does not exist');
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

  async getAllTopics({
    page,
    pageSize,
    semesterId,
    majorId
  }: {
    page: number;
    pageSize: number;
    semesterId?: string;
    majorId?: string;
  }) {
    // Kiểm tra UUID nếu có semesterId hoặc majorId
    if (semesterId && !isUUID(semesterId)) {
      throw new Error('ID semester is not valid');
    }


    if (majorId && !isUUID(majorId)) {
      throw new Error('ID major is not valid');
    }


    const where = {
      ...(semesterId && { semesterId }),
      ...(majorId && {
        detailMajorTopics: {
          some: {
            majorId
          }
        }
      })
    };

    const [topics, totalItems] = await Promise.all([
      prisma.topic.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
        include: {
          detailMajorTopics: {
            include: {
              major: true
            }
          },
          semester: {
            include: {
              year: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.topic.count({ where })
    ]);

    return {
      data: topics,
      currentPage: page,
      totalPages: Math.ceil(totalItems / pageSize),
      totalItems,
      pageSize
    };
  }
} 