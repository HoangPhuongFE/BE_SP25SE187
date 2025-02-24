import { PrismaClient } from '@prisma/client';
import { TOPIC_MESSAGE } from '../constants/message';
import { validate as isUUID } from 'uuid';
import axios from 'axios';

const prisma = new PrismaClient();

interface TopicDocument {
  fileName: string;
  filePath: string;
}

interface RegisterTopicData {
  name: string;
  description: string;
  userId: string;
  semesterId: string;
  majorId: string;
  documents?: TopicDocument[];
}

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


    const semesterPrefixes: { [key: string]: string } = {
      'Spring': 'SP',
      'Summer': 'SU',
      'Fall': 'FA'
    };
    const semesterPrefix = semesterPrefixes[semester.code.split(' ')[0] as string] || 'FA';

    const yearSuffix = semester.year.year.toString().slice(-2);
    const topicCount = await prisma.topic.count({
      where: { semesterId: semester.id }
    });

    return `${semesterPrefix}${yearSuffix}${major.name}${(topicCount + 1).toString().padStart(3, '0')}`;
  }

  private async validateWithGemini(text: string, type: 'name' | 'code'): Promise<{
    isValid: boolean;
    message?: string;
  }> {
    try {
      if (!text || typeof text !== 'string') {
        throw new Error('Văn bản kiểm tra không hợp lệ');
      }

      let prompt = '';
      if (type === 'name') {
        prompt = `Là một chuyên gia đánh giá đề tài, hãy kiểm tra tên đề tài sau có đúng format không: "${text}".
    
        Tiêu chí đánh giá (chỉ cần đáp ứng các yêu cầu format sau):
        1. Độ dài: Từ 5-50 từ
        2. Cấu trúc: Có thể bắt đầu bằng một trong các từ: "Nghiên cứu", "Xây dựng", "Phát triển", "Thiết kế", "Ứng dụng"
        3. Tính rõ ràng: có thể có các thành phần [Hành động] + [Đối tượng/Hệ thống] + [Công nghệ/Phương pháp]
        4. Từ ngữ: Không chứa từ ngữ không phù hợp hoặc nhạy cảm
    
        không bắt buộc phải đáp ứng hết các tiêu chí, chỉ cần đáp ứng hai tiêu chí trong bốn tiêu chí trên là được
        
        Chỉ trả về JSON với format sau, không thêm bất kỳ text nào khác:
        {
          "isValid": boolean,
          "message": string (nêu lý do chính nếu không hợp lệ)
        }`;
      } else {
       prompt = `Là một chuyên gia kiểm tra mã code, hãy kiểm tra xem mã đề tài "${text}" có đúng định dạng không.
    
        Quy tắc định dạng:
        1. Phải bắt đầu bằng một trong ba giá trị: SP, SU, FA (không phân biệt hoa thường)
        2. Sau đó là 2 số (22 cho đến số năm cộng thêm 2)
        3. Tiếp theo là 2-4 chữ cái viết hoa
        4. Kết thúc bằng 4 chữ số (0000-9999)
        
        Ví dụ hợp lệ: SP23SE001, FA23IT002, SU23CS003
        
        Chỉ trả về JSON với format:
        {
          "isValid": boolean,
          "message": string (để trống nếu hợp lệ, nêu lý do nếu không hợp lệ)
        }`;
      }

      const timeoutMs = 10000;
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: timeoutMs
        }
      );

      // Parse response từ Gemini
      const content = (response.data as any).candidates[0].content.parts[0].text;
      let result;
      try {
        // Tìm và parse phần JSON trong response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Không tìm thấy JSON trong phản hồi');
        }
        result = JSON.parse(jsonMatch[0]);
      } catch (error) {
        throw new Error('Không thể parse kết quả JSON từ AI');
      }

      // Validate kết quả
      if (typeof result.isValid !== 'boolean' || typeof result.message !== 'string') {
        throw new Error('Format JSON không hợp lệ');
      }

      // Log kết quả kiểm tra
      await prisma.aIVerificationLog.create({
        data: {
          topicId: '', // Sẽ cập nhật sau khi tạo topic
          verification: type,
          originalText: text,
          verifiedText: text,
          similarityScore: result.isValid ? 1 : 0,
          suggestions: result.message,
          verifiedBy: 'GEMINI_AI',
          verifiedAt: new Date()
        }
      });

      return {
        isValid: result.isValid,
        message: result.message
      };

    } catch (error) {
      console.error('Gemini Validation Error:', error);
      
      await prisma.systemLog.create({
        data: {
          action: 'GEMINI_VALIDATION',
          entityType: 'TOPIC',
          entityId: 'N/A',
          error: (error as Error).message,
          stackTrace: (error as Error).stack,
          severity: 'ERROR',
          ipAddress: 'UNKNOWN',
          userId: 'SYSTEM'
        }
      }).catch(console.error);

      if (process.env.NODE_ENV === 'production') {
        return { 
          isValid: true, 
          message: 'Không thể kiểm tra với AI, chấp nhận giá trị mặc định' 
        };
      }
      
      throw new Error(`Lỗi kiểm tra Gemini: ${(error as Error).message}`);
    }
  }

  public async validateWithAI(text: string, type: 'name' | 'code'): Promise<{
    isValid: boolean;
    message?: string;
  }> {
    return this.validateWithGemini(text, type);
  }

  private async logSystemAction(action: string, entityId: string, description: string, userId: string, error?: Error) {
    try {
      await prisma.systemLog.create({
        data: {
          userId,
          action,
          entityType: 'TOPIC',
          entityId,
          description,
          error: error?.message,
          stackTrace: error?.stack,
          severity: error ? 'ERROR' : 'INFO',
          ipAddress: 'SYSTEM',
        }
      });
    } catch (logError) {
      console.error('Failed to create system log:', logError);
    }
  }

  private async createTopicDocument(topicId: string, file: TopicDocument & { uploadedBy: string }) {
    return prisma.document.create({
      data: {
        fileName: file.fileName,
        filePath: file.filePath,
        documentType: 'TOPIC',
        relatedTable: 'topics',
        uploadedBy: file.uploadedBy,
      }
    });
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
    documents?: Array<{
      fileName: string;
      filePath: string;
    }>;
  }) {
    try {
      const topic = await prisma.$transaction(async (tx) => {
        // Tạo topic
        const newTopic = await tx.topic.create({
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

        // Tạo documents nếu có
        if (data.documents?.length) {
          await Promise.all(data.documents.map(doc => 
            this.createTopicDocument(newTopic.id, {
              ...doc,
              uploadedBy: data.createdBy
            })
          ));
        }

        return newTopic;
      });

      // Ghi log thành công
      await this.logSystemAction(
        'CREATE_TOPIC',
        topic.id,
        `Created topic: ${topic.name}`,
        data.createdBy
      );

      return topic;

    } catch (error) {
      // Ghi log lỗi
      await this.logSystemAction(
        'CREATE_TOPIC_ERROR',
        'N/A',
        'Failed to create topic',
        data.createdBy,
        error as Error
      );
      throw error;
    }
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

    const userRoles = user?.roles.map((ur: { role: { name: any; }; }) => ur.role.name);

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
    return prisma.$transaction(async (tx: { topicRegistration: { update: (arg0: { where: { id: string; }; data: { status: string; reviewerId: string | undefined; reviewedAt: Date; }; }) => any; }; topic: { update: (arg0: { where: { id: any; }; data: { status: string; }; }) => any; }; }) => {
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

  async registerTopic(data: RegisterTopicData) {
    try {
      // Tạo mã đề tài tự động
      const topicCode = await this.generateTopicCode(data.semesterId, data.majorId);

      // Tạo topic và registration trong transaction
      const result = await prisma.$transaction(async (tx) => {
        const topic = await tx.topic.create({
          data: {
            topicCode,
            name: data.name,
            description: data.description,
            status: 'PENDING',
            isBusiness: false,
            semesterId: data.semesterId,
            createdBy: data.userId,
            detailMajorTopics: {
              create: [{
                majorId: data.majorId,
                status: 'ACTIVE'
              }]
            }
          }
        });

        // Tạo documents nếu có
        if (data.documents?.length) {
          await Promise.all(data.documents.map(doc =>
            this.createTopicDocument(topic.id, {
              ...doc,
              uploadedBy: data.userId
            })
          ));
        }

        const registration = await tx.topicRegistration.create({
          data: {
            topicId: topic.id,
            userId: data.userId,
            role: 'mentor',
            status: 'pending'
          }
        });

        return { registration, topic };
      });

      // Ghi log
      await this.logSystemAction(
        'REGISTER_TOPIC',
        result.topic.id,
        `Registered topic: ${result.topic.name}`,
        data.userId
      );

      return result;
    } catch (error) {
      await this.logSystemAction(
        'REGISTER_TOPIC_ERROR',
        'N/A',
        'Failed to register topic',
        data.userId,
        error as Error
      );
      throw error;
    }
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
    data: {
      status: 'approved' | 'rejected' | 'consider';
      rejectionReason?: string;
      documents?: TopicDocument[];
      reviewerId: string;
    }
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

    // Kiểm tra lý do từ chối khi status là rejected hoặc consider
    if ((data.status === 'rejected' || data.status === 'consider') && !data.rejectionReason) {
      throw new Error('Cần cung cấp lý do khi từ chối hoặc yêu cầu xem xét lại');
    }

    // Kiểm tra documents khi approved
    if (data.status === 'approved' && (!data.documents || data.documents.length === 0)) {
      throw new Error('Cần cung cấp tài liệu đã duyệt khi chấp nhận đề tài');
    }

    // Cập nhật trạng thái đăng ký và topic
    const updatedRegistration = await prisma.$transaction(async (tx) => {
      const registration = await tx.topicRegistration.update({
        where: { id: registrationId },
        data: {
          status: data.status,
          reviewedAt: new Date(),
          reviewerId: data.reviewerId,
          rejectionReason: data.status !== 'approved' ? data.rejectionReason : null,
        },
        include: {
          topic: true,
        }
      });

      // Cập nhật trạng thái topic và tạo documents nếu approved
      if (data.status === 'approved') {
        await tx.topic.update({
          where: { id: registration.topicId },
          data: { status: 'APPROVED' }
        });

        // Tạo documents
        if (data.documents) {
          await Promise.all(data.documents.map(doc =>
            this.createTopicDocument(registration.topicId, {
              ...doc,
              uploadedBy: data.reviewerId
            })
          ));
        }
      } else if (data.status === 'rejected') {
        await tx.topic.update({
          where: { id: registration.topicId },
          data: { status: 'REJECTED' }
        });
      } else if (data.status === 'consider') {
        await tx.topic.update({
          where: { id: registration.topicId },
          data: { status: 'CONSIDER' }
        });
      }

      return registration;
    });

    // Ghi log
    await this.logSystemAction(
      `TOPIC_${data.status.toUpperCase()}`,
      registration.topicId,
      `Topic ${data.status}: ${registration.topic.name}`,
      data.reviewerId
    );

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

    if (!reviewer || !reviewer.roles.some((r: { role: { name: string; }; }) => r.role.name === 'thesis_manager')) {
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
    const council = await prisma.$transaction(async (tx: { council: { create: (arg0: { data: { name: string; topicAssId: any; status: string; members: { create: { userId: string; role: string; status: string; assignedAt: Date; }[]; }; }; include: { members: boolean; }; }) => any; }; topicRegistration: { update: (arg0: { where: { id: string; }; data: { status: string; reviewerId: string; reviewedAt: Date; }; }) => any; }; }) => {
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

  async getTopicDetail(id: string) {
    try {
      if (!isUUID(id)) {
        throw new Error('ID topic không hợp lệ');
      }

      const topic = await prisma.topic.findUnique({
        where: { id },
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
              email: true,
              avatar: true
            }
          },
          topicRegistrations: {
            include: {
              topic: true
            }
          }
        }
      });

      if (!topic) {
        throw new Error(TOPIC_MESSAGE.TOPIC_NOT_FOUND);
      }

      // Lấy documents từ bảng Document
      const documents = await prisma.document.findMany({
        where: {
          relatedTable: 'topics',
          documentType: 'TOPIC'
        },
        select: {
          id: true,
          fileName: true,
          filePath: true,
          documentType: true,
          uploadedAt: true,
          uploadedBy: true,
          uploader: {
            select: {
              fullName: true,
              email: true
            }
          }
        }
      });

      const topicWithUrls = {
        ...topic,
        documents: documents.map(doc => ({
          ...doc,
          fileUrl: `${process.env.BASE_URL}/uploads/topics/${doc.filePath}`
        }))
      };

      // Ghi log
      await this.logSystemAction(
        'VIEW_TOPIC_DETAIL',
        id,
        `Viewed topic detail: ${topic.name}`,
        'SYSTEM'
      );

      return topicWithUrls;
    } catch (error) {
      await this.logSystemAction(
        'VIEW_TOPIC_DETAIL_ERROR',
        id,
        'Failed to view topic detail',
        'SYSTEM',
        error as Error
      );
      throw error;
    }
  }
} 