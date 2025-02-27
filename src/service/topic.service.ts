import { PrismaClient } from '@prisma/client';
import { TOPIC_MESSAGE, USER_MESSAGE } from '../constants/message';
import { validate as isUUID } from 'uuid';
import axios from 'axios';
import ExcelJS from 'exceljs';
import fs from 'fs';

const prisma = new PrismaClient();

interface TopicDocument {
  fileName: string;
  documentUrl: string;
}

interface RegisterTopicData {
  name: string;
  description: string;
  userId: string;
  semesterId: string;
  majorId: string;
  isBusiness?: boolean;
  businessPartner?: string;
  documents?: TopicDocument[];
  subSupervisor?: string;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    topicCode: string;
    error: string;
  }>;
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
        1. Độ dài: Từ 5-1000 từ (cộng 1 tiêu chí)
        2. Cấu trúc: Có thể bắt đầu bằng một trong các từ: "Nghiên cứu", "Xây dựng", "Phát triển", "Thiết kế", "Ứng dụng" thì cộng 1 tiêu chí
        3. Tính rõ ràng: có thể có các thành phần [Hành động] + [Đối tượng/Hệ thống] + [Công nghệ/Phương pháp] thì cộng 1 tiêu chí
        4. Từ ngữ: Không chứa từ ngữ không phù hợp hoặc nhạy cảm thì cộng 1 tiêu chí
    
        không bắt buộc phải đáp ứng hết các tiêu chí, chỉ cần đáp ứng hai tiêu chí trong bốn tiêu chí name là được
        
        Chỉ trả về JSON với format sau, không thêm bất kỳ text nào khác:
        {
          "isValid": boolean,
          "message": string (nêu lý do chính nếu không hợp lệ, để trống nếu hợp lệ)
        }`;
      } else {
       prompt = `Là một chuyên gia kiểm tra mã code, hãy kiểm tra xem mã đề tài "${text}" có đúng định dạng không.
    
        Quy tắc định dạng:
        1. Phải bắt đầu bằng một trong ba giá trị: SP, SU, FA (không phân biệt hoa thường) (cộng 1 tiêu chí)
        2. Sau đó là 2 số (22 cho đến số năm hiện tại cộng thêm 2) (cộng 1 tiêu chí)
        3. Tiếp theo là 2-4 chữ cái viết hoa (cộng 1 tiêu chí)
        4. Kết thúc bằng 4 chữ số (0000-9999) (cộng 1 tiêu chí)

        không bắt buộc phải đáp ứng hết các tiêu chí, chỉ cần đáp ứng hai tiêu chí trong bốn tiêu chí mã code là được
        
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

      // Log response từ Gemini để debug
      console.log('Gemini Raw Response:', JSON.stringify(response.data, null, 2));

      const content = (response.data as any).candidates[0].content.parts[0].text;
      console.log('Extracted Content:', content);

      let result;
      try {
        // Tìm và parse phần JSON trong response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Không tìm thấy JSON trong phản hồi');
        }
        result = JSON.parse(jsonMatch[0]);
        console.log('Parsed Result:', result);
      } catch (error) {
        console.error('JSON Parse Error:', error);
        throw new Error('Không thể parse kết quả JSON từ AI');
      }

      // Validate kết quả
      if (typeof result.isValid !== 'boolean' || typeof result.message !== 'string') {
        console.error('Invalid Result Format:', result);
        throw new Error('Format JSON không hợp lệ');
      }

      // Log kết quả cuối cùng
      console.log('Final Validation Result:', {
        isValid: result.isValid,
        message: result.message
      });

      return {
        isValid: result.isValid,
        message: result.message
      };

    } catch (error) {
      console.error('Validation Error:', error);
      
      if (process.env.NODE_ENV === 'production') {
        return { 
          isValid: true, 
          message: 'Bỏ qua kiểm tra AI trong môi trường production' 
        };
      }
      
      throw error;
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

  private async createTopicDocument(topicId: string, document: TopicDocument & { uploadedBy: string }) {
    return prisma.topicDocument.create({
      data: {
        topicId,
        fileName: document.fileName,
        documentUrl: document.documentUrl,
        uploadedBy: document.uploadedBy
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
            this.createTopicDocument (newTopic.id, {
              fileName: doc.fileName,
              documentUrl: doc.filePath,
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
    try {
      // Kiểm tra topic có tồn tại không
      const existingTopic = await prisma.topic.findUnique({
        where: { id },
        include: {
          creator: true,
          subMentor: true,
          detailMajorTopics: {
            include: {
              major: true
            }
          }
        }
      });

      if (!existingTopic) {
        throw new Error(TOPIC_MESSAGE.TOPIC_NOT_FOUND);
      }

      // Kiểm tra quyền cập nhật
      if (existingTopic.createdBy !== userId) {
        throw new Error(TOPIC_MESSAGE.UNAUTHORIZED);
      }

      // Kiểm tra mentor chính
      const mentor = await prisma.user.findFirst({
        where: {
          id: userId,
          roles: {
            some: {
              role: {
                name: 'mentor'
              }
            }
          }
        }
      });

      if (!mentor) {
        throw new Error('Chỉ mentor mới có thể cập nhật đề tài');
      }

      // Kiểm tra mentor phụ nếu có
      if (data.subSupervisor) {
        const subMentor = await prisma.user.findFirst({
          where: {
            id: data.subSupervisor,
            roles: {
              some: {
                role: {
                  name: 'mentor'
                }
              }
            }
          }
        });

        if (!subMentor) {
          throw new Error('Mentor phụ không tồn tại hoặc không có quyền mentor');
        }

        if (data.subSupervisor === userId) {
          throw new Error('Mentor phụ không thể là mentor chính');
        }
      }

      // Cập nhật thông tin topic
      const updatedTopic = await prisma.topic.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          isBusiness: data.isBusiness,
          businessPartner: data.businessPartner,
          subSupervisor: data.subSupervisor,
          updatedAt: new Date(),
          detailMajorTopics: {
            deleteMany: {},
            create: data.majorId ? [{
              majorId: data.majorId,
              status: 'ACTIVE'
            }] : []
          }
        },
        include: {
          creator: true,
          subMentor: true,
          detailMajorTopics: {
            include: {
              major: true
            }
          }
        }
      });

      // Cập nhật documents nếu có
      if (data.documents && Array.isArray(data.documents)) {
        // Xóa documents cũ
        await prisma.topicDocument.deleteMany({
          where: { topicId: id }
        });

        // Thêm documents mới
        await Promise.all(
          data.documents.map((doc: { documentUrl: string; fileName: string }) => 
            prisma.topicDocument.create({
              data: {
                topicId: id,
                documentUrl: doc.documentUrl,
                fileName: doc.fileName,
                uploadedBy: userId
              }
            })
          )
        );
      }

      // Log hành động
      await this.logSystemAction(
        'UPDATE_TOPIC',
        id,
        `Topic ${updatedTopic.name} updated by ${mentor.fullName}`,
        userId
      );

      return updatedTopic;
    } catch (error) {
      // Log lỗi
      await this.logSystemAction(
        'UPDATE_TOPIC_ERROR',
        id,
        'Error updating topic',
        userId,
        error as Error
      );
      throw error;
    }
  }

  async deleteTopic(id: string, userId: string) {
    try {
      if (!isUUID(id)) {
        throw new Error(TOPIC_MESSAGE.INVALID_ID);
      }

      // Kiểm tra topic tồn tại và lấy đầy đủ thông tin liên quan
      const topic = await prisma.topic.findUnique({
        where: { id },
        include: {
          topicRegistrations: true,
          detailMajorTopics: true,
          documents: true,
          topicAssignments: true,
          aiVerificationLogs: true,
          semesterTopicMajors: true,
          decisions: true,
          creator: {
            include: {
              roles: {
                include: {
                  role: true
                }
              }
            }
          }
        }
      });

      if (!topic) {
        throw new Error(TOPIC_MESSAGE.TOPIC_NOT_FOUND);
      }

      // Kiểm tra quyền xóa
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
        throw new Error(TOPIC_MESSAGE.UNAUTHORIZED);
      }

      const userRoles = user.roles.map(ur => ur.role.name);
      const isAcademicOfficer = userRoles.includes('academic_officer');
      const isMentor = userRoles.includes('mentor');
      const isCreator = topic.createdBy === userId;

      // Kiểm tra điều kiện xóa dựa trên status và role
      switch (topic.status) {
        case 'DRAFT':
        case 'PENDING':
        case 'REJECTED':
          // Mentor chỉ được xóa topic của mình và trong các trạng thái này
          if (isMentor && !isCreator) {
            throw new Error(TOPIC_MESSAGE.UNAUTHORIZED);
          }
          break;

        case 'APPROVED':
        case 'CONSIDER':
          // Chỉ academic officer mới được xóa topic đã duyệt hoặc đang xem xét
          if (!isAcademicOfficer) {
            throw new Error(TOPIC_MESSAGE.UNAUTHORIZED);
          }
          break;

        case 'IN_PROGRESS':
        case 'COMPLETED':
          // Không ai được xóa topic đang thực hiện hoặc đã hoàn thành
          throw new Error('Không thể xóa đề tài đang thực hiện hoặc đã hoàn thành');

        case 'CANCELLED':
          // Academic officer hoặc mentor tạo topic có thể xóa topic đã hủy
          if (!isAcademicOfficer && !(isMentor && isCreator)) {
            throw new Error(TOPIC_MESSAGE.UNAUTHORIZED);
          }
          break;

        default:
          throw new Error('Trạng thái đề tài không hợp lệ');
      }

      // Kiểm tra các ràng buộc khác
      const hasActiveRegistrations = topic.topicRegistrations.some(
        (reg: { status: string }) => ['approved', 'pending'].includes(reg.status.toLowerCase())
      );

      if (hasActiveRegistrations) {
        throw new Error(TOPIC_MESSAGE.TOPIC_IN_USE);
      }

      // Sử dụng transaction để đảm bảo tính toàn vẹn dữ liệu
      await prisma.$transaction(async (tx) => {
        // Xóa các bản ghi liên quan
        await tx.topicDocument.deleteMany({
          where: { topicId: id }
        });

        await tx.detailMajorTopic.deleteMany({
          where: { topicId: id }
        });

        await tx.semesterTopicMajor.deleteMany({
          where: { topicId: id }
        });

        await tx.aIVerificationLog.deleteMany({
          where: { topicId: id }
        });

        // Xóa topic
        await tx.topic.delete({
          where: { id }
        });
      });

      // Log hành động xóa
      await this.logSystemAction(
        'DELETE_TOPIC',
        id,
        `Topic ${topic.name} deleted by ${user.fullName}`,
        userId
      );

    } catch (error) {
      // Log lỗi
      await this.logSystemAction(
        'DELETE_TOPIC_ERROR',
        id,
        'Error deleting topic',
        userId,
        error as Error
      );
      throw error;
    }
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

  async getTopicsByStatus(status: string, page: number, pageSize: number) {
    const topics = await prisma.topic.findMany({
      where: { status },
      skip: (page - 1) * pageSize,
      take: pageSize
    });

    return topics;
  }

  private isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
    const validTransitions: { [key: string]: string[] } = {
      'DRAFT': ['PENDING'],
      'PENDING': ['APPROVED', 'REJECTED', 'CONSIDER'],
      'APPROVED': ['IN_PROGRESS'],
      'REJECTED': ['DRAFT'],
      'CONSIDER': ['PENDING'],
      'IN_PROGRESS': ['COMPLETED', 'CANCELLED']
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  async updateTopicStatus(topicId: string, newStatus: string, userId: string) {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId }
    });
    
    if (!topic) {
      throw new Error(TOPIC_MESSAGE.TOPIC_NOT_FOUND);
    }

    if (!this.isValidStatusTransition(topic.status, newStatus)) {
      throw new Error(TOPIC_MESSAGE.STATUS_TRANSITION_INVALID);
    }

    return prisma.topic.update({
      where: { id: topicId },
      data: { 
        status: newStatus,
        updatedAt: new Date()
      }
    });
  }

  async registerTopic(data: RegisterTopicData) {
    try {
      // Kiểm tra mentor chính
      const mentor = await prisma.user.findFirst({
        where: {
          id: data.userId,
          roles: {
            some: {
              role: {
                name: 'mentor'
              }
            }
          }
        }
      });

      if (!mentor) {
        throw new Error('Chỉ mentor mới có thể đăng ký đề tài');
      }

      // Kiểm tra mentor phụ nếu có
      if (data.subSupervisor) {
        const subMentor = await prisma.user.findFirst({
          where: {
            id: data.subSupervisor,
            roles: {
              some: {
                role: {
                  name: 'mentor'
                }
              }
            }
          }
        });

        if (!subMentor) {
          throw new Error('Mentor phụ không hợp lệ');
        }

        // Kiểm tra xem subSupervisor có phải là mentor chính không
        if (data.subSupervisor === data.userId) {
          throw new Error('Mentor phụ không thể là mentor chính');
        }
      }

      // Tạo mã đề tài
      const topicCode = await this.generateTopicCode(data.semesterId, data.majorId);

      // Tạo topic mới với subSupervisor
      const topic = await prisma.topic.create({
        data: {
          topicCode,
          name: data.name,
          description: data.description,
          semesterId: data.semesterId,
          isBusiness: data.isBusiness || false,
          businessPartner: data.businessPartner,
          status: 'PENDING',
          createdBy: data.userId,
          subSupervisor: data.subSupervisor,
          detailMajorTopics: {
            create: {
              majorId: data.majorId,
              status: 'ACTIVE'
            }
          }
        },
        include: {
          creator: true,
          subMentor: true,
          detailMajorTopics: {
            include: {
              major: true
            }
          }
        }
      });

      // Tạo đăng ký cho mentor chính
      await prisma.topicRegistration.create({
        data: {
          topicId: topic.id,
          userId: data.userId,
          role: 'mentor',
          status: 'PENDING'
        }
      });

      // Xử lý documents nếu có
      if (data.documents && data.documents.length > 0) {
        for (const doc of data.documents) {
          await this.createTopicDocument(topic.id, {
            ...doc,
            uploadedBy: data.userId
          });
        }
      }

      // Log hành động
      await this.logSystemAction(
        'REGISTER_TOPIC',
        topic.id,
        `Mentor ${data.userId} đã đăng ký đề tài mới${data.subSupervisor ? ` với mentor phụ ${data.subSupervisor}` : ''}`,
        data.userId
      );

      return topic;
    } catch (error) {
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
          status,
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
    const council = await prisma.$transaction(async (tx) => {
      // Tạo council
      const newCouncil = await tx.council.create({
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

      return newCouncil;
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

  async getTopicsForExport({
    semesterId,
    majorId,
    status,
    isBusiness
  }: {
    semesterId?: string;
    majorId?: string;
    status?: string;
    isBusiness?: boolean;
  }) {
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
      ...(isBusiness !== undefined && { isBusiness })
    };

    const topics = await prisma.topic.findMany({
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
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return topics;
  }

  async importTopicEvaluations(
    worksheet: ExcelJS.Worksheet,
    reviewerId: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      total: 0,
      success: 0,
      failed: 0,
      errors: []
    };

    // Bỏ qua hàng header
    const rows = worksheet.getRows(2, worksheet.rowCount - 1) || [];
    result.total = rows.length;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      try {
        const topicCode = row.getCell('Mã đề tài').text.trim();
        const status = row.getCell('Trạng thái').text.trim().toLowerCase();
        const rejectionReason = row.getCell('Lý do từ chối').text.trim();

        // Validate dữ liệu
        if (!topicCode) {
          throw new Error('Mã đề tài không được để trống');
        }

        if (!['approved', 'rejected', 'consider'].includes(status)) {
          throw new Error('Trạng thái không hợp lệ');
        }

        if ((status === 'rejected' || status === 'consider') && !rejectionReason) {
          throw new Error('Cần cung cấp lý do khi từ chối hoặc yêu cầu xem xét lại');
        }

        // Tìm topic registration dựa trên topic code
        const topic = await prisma.topic.findUnique({
          where: { topicCode },
          include: {
            topicRegistrations: true
          }
        });

        if (!topic) {
          throw new Error('Không tìm thấy đề tài');
        }

        const registration = topic.topicRegistrations[0];
        if (!registration) {
          throw new Error('Không tìm thấy đăng ký đề tài');
        }

        // Cập nhật trạng thái đăng ký và topic
        await prisma.$transaction(async (tx) => {
          // Cập nhật registration
          await tx.topicRegistration.update({
            where: { id: registration.id },
            data: {
              status,
              reviewedAt: new Date(),
              reviewerId,
              rejectionReason: status !== 'approved' ? rejectionReason : null,
            }
          });

          // Cập nhật topic status
          const topicStatus = status === 'approved' ? 'APPROVED' 
            : status === 'rejected' ? 'REJECTED' 
            : 'CONSIDER';

          await tx.topic.update({
            where: { id: topic.id },
            data: { status: topicStatus }
          });
        });

        // Ghi log
        await this.logSystemAction(
          `TOPIC_${status.toUpperCase()}`,
          topic.id,
          `Topic ${status} through import: ${topic.name}`,
          reviewerId
        );

        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          topicCode: row.getCell('Mã đề tài').text.trim(),
          error: (error as Error).message
        });
      }
    }

    return result;
  }

  async assignTopicToGroup(data: {
    topicId: string;
    groupId: string;
    mentorId: string;
  }) {
    const { topicId, groupId, mentorId } = data;

    // Kiểm tra topic có tồn tại không và đã được gán chưa
    const existingAssignment = await prisma.topicAssignment.findFirst({
      where: {
        OR: [
          { topicId: topicId },
          { groupId: groupId }
        ]
      }
    });

    if (existingAssignment) {
      if (existingAssignment.topicId === topicId) {
        throw new Error('Đề tài này đã được gán cho một nhóm khác');
      } else {
        throw new Error('Nhóm này đã được gán đề tài khác');
      }
    }

    // Kiểm tra topic có tồn tại không
    const topic = await prisma.topic.findUnique({
      where: { id: topicId }
    });

    if (!topic) {
      throw new Error(TOPIC_MESSAGE.TOPIC_NOT_FOUND);
    }

    // Kiểm tra group có tồn tại không
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      throw new Error('Không tìm thấy nhóm');
    }

    // Kiểm tra mentor có phải là người tạo topic không
    if (topic.createdBy !== mentorId) {
      throw new Error('Chỉ mentor tạo đề tài mới có thể gán đề tài cho nhóm');
    }

    // Tạo topic assignment
    const topicAssignment = await prisma.topicAssignment.create({
      data: {
        topicId,
        groupId,
        assignedBy: mentorId,
        approvalStatus: 'PENDING',
        defendStatus: 'NOT_STARTED'
      }
    });

    // Log hành động
    await this.logSystemAction(
      'ASSIGN_TOPIC',
      topicId,
      `Mentor ${mentorId} đã gán đề tài cho nhóm ${groupId}`,
      mentorId
    );

    return topicAssignment;
  }
} 