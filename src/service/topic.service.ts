import { PrismaClient } from '@prisma/client';
import { TOPIC_MESSAGE } from '../constants/message';
import { validate as isUUID } from 'uuid';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

  public async validateWithAI(text: string, type: 'name' | 'code'): Promise<{
    isValid: boolean;
    message?: string;
  }> {
    try {
      // Kiểm tra input
      if (!text || typeof text !== 'string') {
        throw new Error('Văn bản kiểm tra không hợp lệ');
      }

      // Tạo prompt dựa trên loại kiểm tra
      let prompt = '';
      if (type === 'name') {
        prompt = `Là một chuyên gia đánh giá đề tài, hãy kiểm tra tên đề tài sau có phù hợp không: "${text}".
        
        Tiêu chí đánh giá:
        1. Tính rõ ràng: Phải mô tả rõ ràng nội dung nghiên cứu
        2. Tính phù hợp: Không chứa từ ngữ không phù hợp hoặc nhạy cảm
        3. Độ dài: Không quá ngắn (ít nhất 10 từ) hoặc quá dài (tối đa 50 từ)
        4. Tính học thuật: Phải thể hiện tính nghiên cứu, học thuật
        5. Tính khả thi: Phạm vi nghiên cứu phải phù hợp với sinh viên đại học
        
        Trả về JSON với format: 
        {
          "isValid": boolean,
          "message": string (lý do nếu không hợp lệ, "Hợp lệ" nếu đạt yêu cầu)
        }`;
      } else {
        prompt = `Là một chuyên gia kiểm tra mã code, hãy kiểm tra mã đề tài sau có đúng định dạng không: "${text}".
        
        Tiêu chí đánh giá:
        1. Định dạng: [Học kỳ 2 ký tự][Năm 2 số][Mã ngành 2-4 ký tự][Số thứ tự 3 số]
        2. Học kỳ: SP (Spring), SU (Summer), FA (Fall)
        3. Năm: 2 số cuối của năm hiện tại
        4. Không chứa ký tự đặc biệt hoặc khoảng trắng
        5. Độ dài tổng thể phải từ 9-12 ký tự
        
        Trả về JSON với format:
        {
          "isValid": boolean,
          "message": string (lý do nếu không hợp lệ, "Hợp lệ" nếu đạt yêu cầu)
        }`;
      }

      // Thêm timeout cho API call
      const timeoutMs = 10000; // 10 giây
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout khi gọi API AI')), timeoutMs);
      });

      // Gọi OpenAI API với timeout
      const completionPromise = openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "Bạn là một chuyên gia đánh giá đề tài nghiêm túc. Hãy đánh giá chính xác và trả về kết quả theo format JSON được yêu cầu."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: "gpt-3.5-turbo",
        temperature: 0.3,
        response_format: { type: "json_object" },
        max_tokens: 500 // Giới hạn độ dài response
      });

      const completion = await Promise.race([completionPromise, timeoutPromise]) as any;

      // Validate và parse response
      if (!completion?.choices?.[0]?.message?.content) {
        throw new Error('Phản hồi từ AI không hợp lệ');
      }

      let response;
      try {
        response = JSON.parse(completion.choices[0].message.content);
        if (typeof response.isValid !== 'boolean' || typeof response.message !== 'string') {
          throw new Error('Format JSON không hợp lệ');
        }
      } catch (error) {
        throw new Error('Không thể parse kết quả JSON từ AI');
      }

      // Cache kết quả nếu cần
      const cacheKey = `ai_validation:${type}:${text}`;
      // TODO: Implement caching mechanism here

      // Lưu log kiểm tra với transaction
      await prisma.$transaction(async (tx) => {
        await tx.aIVerificationLog.create({
          data: {
            topicId: '', // Sẽ cập nhật sau khi tạo topic
            verification: type,
            originalText: text,
            verifiedText: text,
            similarityScore: response.isValid ? 1 : 0,
            suggestions: response.message,
            verifiedBy: 'AI_SYSTEM',
            verifiedAt: new Date()
          }
        });
      });

      return {
        isValid: response.isValid,
        message: response.message
      };
    } catch (error) {
      console.error('AI Validation Error:', error);
      
      // Log error chi tiết
      await prisma.systemLog.create({
        data: {
          action: 'AI_VALIDATION',
          entityType: 'TOPIC',
          entityId: 'N/A',
          error: (error as Error).message,
          stackTrace: (error as Error).stack,
          severity: 'ERROR',
          ipAddress: 'UNKNOWN',
          userId: 'SYSTEM'
        }
      }).catch(console.error); // Không throw error nếu log thất bại

      // Xử lý theo môi trường
      if (process.env.NODE_ENV === 'production') {
        return { 
          isValid: true, 
          message: 'Không thể kiểm tra với AI, chấp nhận giá trị mặc định' 
        };
      }
      
      throw new Error(`Lỗi kiểm tra AI: ${(error as Error).message}`);
    }
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
        status: 'APPROVED',
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
    majorId,
    status,
    isBusiness,
    search,
    createdBy
  }: {
    page: number;
    pageSize: number;
    semesterId?: string;
    majorId?: string;
    status?: string;
    isBusiness?: boolean;
    search?: string;
    createdBy?: string;
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
      }),
      ...(status && { status }),
      ...(isBusiness !== undefined && { isBusiness }),
      ...(createdBy && { createdBy }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { description: { contains: search } },
          { topicCode: { contains: search } }
        ]
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
          },
          creator: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          },
          topicRegistrations: {
            include: {
              topic: true
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

  async approveTopicRegistration(
    registrationId: string,
    status: 'approved' | 'rejected',
    reviewerId: string
  ) {
    if (!isUUID(registrationId)) {
      throw new Error('ID đăng ký không hợp lệ');
    }

    const registration = await prisma.topicRegistration.findUnique({
      where: { id: registrationId },
      include: {
        topic: true,
      }
    });

    if (!registration) {
      throw new Error(TOPIC_MESSAGE.TOPIC_REGISTRATION_NOT_FOUND);
    }

    // Kiểm tra reviewer có quyền duyệt không (phải là Graduation Thesis Manager)
    const reviewer = await prisma.user.findUnique({
      where: { id: reviewerId },
      include: { roles: { include: { role: true } } }
    });

    if (!reviewer || !reviewer.roles.some(r => r.role.name === 'thesis_manager')) {
      throw new Error('Chỉ Quản lý khóa luận mới có quyền duyệt đề tài');
    }

    // Cập nhật trạng thái đăng ký và topic
    const updatedRegistration = await prisma.$transaction(async (tx) => {
      // Cập nhật trạng thái đăng ký
      const registration = await tx.topicRegistration.update({
        where: { id: registrationId },
        data: {
          status,
          reviewedAt: new Date(),
          reviewerId,
        },
        include: {
          topic: true,
        }
      });

      // Nếu duyệt đồng ý, cập nhật trạng thái topic
      if (status === 'approved') {
        await tx.topic.update({
          where: { id: registration.topicId },
          data: { status: 'APPROVED' }
        });
      }

      return registration;
    });

    return updatedRegistration;
  }

  async createTopicReviewCouncil(
    registrationId: string,
    data: {
      numberOfMembers: number;
      mentorIds: string[];
      reviewerId: string;
    }
  ) {
    if (!isUUID(registrationId)) {
      throw new Error('ID đăng ký không hợp lệ');
    }

    // Kiểm tra số lượng thành viên hội đồng
    if (data.numberOfMembers < 1) {
      throw new Error('Số lượng thành viên hội đồng phải lớn hơn 0');
    }

    // Kiểm tra số lượng mentor phải khớp với numberOfMembers
    if (data.mentorIds.length !== data.numberOfMembers) {
      throw new Error('Số lượng mentor phải khớp với số lượng thành viên hội đồng');
    }

    // Kiểm tra tồn tại của registration
    const registration = await prisma.topicRegistration.findUnique({
      where: { id: registrationId },
      include: {
        topic: true,
      }
    });

    if (!registration) {
      throw new Error(TOPIC_MESSAGE.TOPIC_REGISTRATION_NOT_FOUND);
    }

    // Kiểm tra reviewer có phải là Graduation Thesis Manager không
    const reviewer = await prisma.user.findUnique({
      where: { id: data.reviewerId },
      include: { roles: { include: { role: true } } }
    });

    if (!reviewer || !reviewer.roles.some(r => r.role.name === 'thesis_manager')) {
      throw new Error('Chỉ Quản lý khóa luận mới có quyền tạo hội đồng duyệt');
    }

    // Kiểm tra các mentor có tồn tại và có role mentor không
    const mentors = await prisma.user.findMany({
      where: {
        id: { in: data.mentorIds },
        roles: {
          some: {
            role: {
              name: 'mentor'
            }
          }
        }
      }
    });

    if (mentors.length !== data.mentorIds.length) {
      throw new Error('Một hoặc nhiều mentor không tồn tại hoặc không có quyền mentor');
    }

    // Kiểm tra xem có mentor nào trùng lặp không
    const uniqueMentorIds = new Set(data.mentorIds);
    if (uniqueMentorIds.size !== data.mentorIds.length) {
      throw new Error('Không thể chọn cùng một mentor nhiều lần');
    }

    // Tạo council và council members trong một transaction
    const council = await prisma.$transaction(async (tx) => {
      // Tạo council
      const council = await tx.council.create({
        data: {
          name: `Council-${registration.topic.topicCode}`,
          topicAssId: registration.topicId,
          status: 'PENDING',
          members: {
            create: data.mentorIds.map(mentorId => ({
              userId: mentorId,
              role: 'REVIEWER',
              status: 'PENDING',
              assignedAt: new Date()
            }))
          }
        },
        include: {
          members: true
        }
      });

      // Cập nhật trạng thái của topic registration
      await tx.topicRegistration.update({
        where: { id: registrationId },
        data: {
          status: 'pending_review',
          reviewerId: data.reviewerId,
          reviewedAt: new Date()
        }
      });

      return council;
    });

    return council;
  }
} 