import { PrismaClient } from '@prisma/client';
import { TOPIC_MESSAGE, USER_MESSAGE } from '../constants/message';
import { validate as isUUID } from 'uuid';
import axios from 'axios';
import ExcelJS from 'exceljs';
import fs from 'fs';
import { v4 as uuidv4 } from "uuid";

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
    console.log("Creating topic document:", { topicId, document });
    
    const result = await prisma.topicDocument.create({
      data: {
        topicId,
        fileName: document.fileName,
        documentUrl: document.documentUrl,
        uploadedBy: document.uploadedBy
      }
    });
    
    console.log("Topic document created:", result);
    return result;
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
      console.log("Service createTopic - Input data:", {
        ...data,
        documents: data.documents || []
      });

      // Bắt đầu transaction
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

        console.log("Topic created:", newTopic);

        // Tạo documents nếu có
        if (data.documents && data.documents.length > 0) {
          console.log("Creating documents:", data.documents);
          
          const createdDocs = [];
          for (const doc of data.documents) {
            console.log("Creating document in transaction:", { topicId: newTopic.id, fileName: doc.fileName });
            
            const createdDoc = await tx.topicDocument.create({
              data: {
                topicId: newTopic.id,
              fileName: doc.fileName,
              documentUrl: doc.filePath,
            uploadedBy: data.createdBy
              }
            });
            
            createdDocs.push(createdDoc);
          }
          
          console.log("Documents created:", createdDocs);
        }

        // Lấy topic đã cập nhật bao gồm documents
        const updatedTopic = await tx.topic.findUnique({
          where: { id: newTopic.id },
          include: {
            detailMajorTopics: {
              include: {
                major: true
              }
            },
            topicDocuments: {
              select: {
                id: true,
                fileName: true,
                documentUrl: true,
                uploadedAt: true,
                uploader: {
                  select: {
                    id: true,
                    fullName: true
                  }
                }
              }
            }
          }
        });

        console.log("Updated topic with documents:", updatedTopic);
        
        return updatedTopic || newTopic;
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
      console.error("Error in service createTopic:", error);
      
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
      // Kiểm tra xem mentorID có phải là mentor không
      const mentorRole = await prisma.userRole.findFirst({
        where: {
          userId: data.userId,
              role: {
                name: 'mentor'
              }
            }
      });

      if (!mentorRole) {
        throw new Error(TOPIC_MESSAGE.UNAUTHORIZED);
      }

      // Kiểm tra xem đã vượt quá số lượng đề tài có thể đăng ký chưa
      const mentorTopicsCount = await prisma.topic.count({
        where: {
          createdBy: data.userId,
          topicRegistrations: {
            some: {
              userId: data.userId,
              submissionPeriod: {
                semesterId: data.semesterId,
                status: 'ACTIVE'
              }
            }
          }
        }
      });

      // Nếu đã vượt quá 3 đề tài
      if (mentorTopicsCount >= 3) {
        throw new Error(TOPIC_MESSAGE.MENTOR_MAX_TOPICS_REACHED);
      }

      // Kiểm tra semesterId và majorId đều là UUID hợp lệ
      if (!this.isValidUuid(data.semesterId)) {
        throw new Error('semesterId không hợp lệ');
      }
      if (!this.isValidUuid(data.majorId)) {
        throw new Error('majorId không hợp lệ');
      }

      // Nếu có subSupervisor, kiểm tra subSupervisor có tồn tại và có phải mentor không
      if (data.subSupervisor) {
        const subMentor = await prisma.userRole.findFirst({
          where: {
            userId: data.subSupervisor,
                role: {
                  name: 'mentor'
                }
          },
          include: {
            user: true
          }
        });

        if (!subMentor) {
          throw new Error('Mentor phụ không tồn tại hoặc không phải là mentor');
        }
      }

      // Tìm đợt đăng ký đề tài hiện tại
      const activePeriod = await prisma.topicSubmissionPeriod.findFirst({
        where: {
          semesterId: data.semesterId,
          status: 'ACTIVE',
          startDate: { lte: new Date() },
          endDate: { gte: new Date() }
        }
      });

      if (!activePeriod) {
        throw new Error('Không có đợt đăng ký đề tài nào đang diễn ra');
      }

      // Tạo topicCode
      const topicCode = await this.generateTopicCode(data.semesterId, data.majorId);

      // Sử dụng transaction để đảm bảo tính nhất quán dữ liệu
      const result = await prisma.$transaction(async (tx) => {
      // Tạo topic mới với subSupervisor
        const newTopic = await tx.topic.create({
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

        console.log("Topic created:", newTopic);

      // Tạo đăng ký cho mentor chính
        const registration = await tx.topicRegistration.create({
        data: {
            topicId: newTopic.id,
          userId: data.userId,
          role: 'mentor',
          status: 'PENDING',
          submissionPeriodId: activePeriod.id
        },
        include: {
          submissionPeriod: true
        }
      });

        console.log("Registration created:", registration);

      // Xử lý documents nếu có
        const createdDocs = [];
      if (data.documents && data.documents.length > 0) {
          console.log("Creating documents:", data.documents);
          
        for (const doc of data.documents) {
            console.log("Creating document in transaction:", { topicId: newTopic.id, fileName: doc.fileName });
            
            const createdDoc = await tx.topicDocument.create({
              data: {
                topicId: newTopic.id,
                fileName: doc.fileName,
                documentUrl: doc.documentUrl || '',
            uploadedBy: data.userId
              }
            });
            
            createdDocs.push(createdDoc);
          }
          
          console.log("Documents created:", createdDocs);
        }

        // Lấy topic đã cập nhật bao gồm documents
        const updatedTopic = await tx.topic.findUnique({
          where: { id: newTopic.id },
          include: {
            creator: true,
            subMentor: true,
            detailMajorTopics: {
              include: {
                major: true
              }
            },
            topicDocuments: {
              select: {
                id: true,
                fileName: true,
                documentUrl: true,
                uploadedAt: true,
                uploader: {
                  select: {
                    id: true,
                    fullName: true
                  }
                }
              }
            }
          }
        });

      return {
          ...updatedTopic,
        submissionPeriod: {
          id: activePeriod.id,
          round: activePeriod.round,
          startDate: activePeriod.startDate,
          endDate: activePeriod.endDate,
          status: activePeriod.status
        }
      };
      });

      // Log hành động
      await this.logSystemAction(
        'REGISTER_TOPIC',
        result?.id || 'unknown',
        `Mentor ${data.userId} đã đăng ký đề tài mới${data.subSupervisor ? ` với mentor phụ ${data.subSupervisor}` : ''}`,
        data.userId
      );

      return result;
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
    createdBy,
    isOfficial
  }: {
    page: number;
    pageSize: number;
    semesterId?: string;
    majorId?: string;
    status?: string;
    isBusiness?: boolean;
    search?: string;
    createdBy?: string;
    isOfficial?: boolean;
  }) {
    try {
      
      // Xác thực các tham số tìm kiếm
      if (semesterId && !this.isValidUuid(semesterId)) {
        throw new Error("semesterId not valid");
      }
      if (majorId && !this.isValidUuid(majorId)) {
        throw new Error("majorId not valid");
      }

      let whereClause: any = {};

      // Lọc theo nhóm đề tài (chính thức hay đề xuất) nếu isOfficial được xác định rõ ràng
      if (isOfficial === true) {
        console.log("Filtering by isOfficial: true (official topics)");
        
        // Tìm người dùng với vai trò academic_officer
        const academicOfficers = await prisma.userRole.findMany({
          where: {
            role: {
              name: 'academic_officer'
            }
          },
          select: {
            userId: true
          }
        });

        const academicOfficerIds = academicOfficers.map(officer => officer.userId);
        console.log("Academic officer IDs:", academicOfficerIds);
        
        if (academicOfficerIds.length > 0) {
          whereClause.createdBy = { in: academicOfficerIds };
        } else {
          console.log("No academic officers found");
          // Không có academic officers nào, trả về mảng rỗng
          return {
            data: [],
            pagination: {
              page,
              pageSize,
              totalItems: 0,
              totalPages: 0,
              hasNext: false,
              hasPrevious: false
            }
          };
        }
      } else if (isOfficial === false) {
        console.log("Filtering by isOfficial: false (proposed topics)");
        
        // Tìm người dùng với vai trò mentor
        const mentors = await prisma.userRole.findMany({
          where: {
            role: {
              name: 'mentor'
            }
          },
          select: {
            userId: true
          }
        });

        const mentorIds = mentors.map(mentor => mentor.userId);
        console.log("Mentor IDs:", mentorIds);
        
        if (mentorIds.length > 0) {
          whereClause.createdBy = { in: mentorIds };
        } else {
          console.log("No mentors found");
          // Không có mentors nào, trả về mảng rỗng
          return {
            data: [],
            pagination: {
              page,
              pageSize,
              totalItems: 0,
              totalPages: 0,
              hasNext: false,
              hasPrevious: false
            }
          };
        }

        // Thêm điều kiện cho đề xuất đề tài
        whereClause.topicRegistrations = {
          some: {}
        };
      } else {
        console.log("Not filtering by isOfficial, showing all topics");
      }

      // Bổ sung thêm các điều kiện lọc khác
      if (semesterId) {
        whereClause.semesterId = semesterId;
      }

      if (status) {
        whereClause.status = status;
      }

      if (isBusiness !== undefined) {
        whereClause.isBusiness = isBusiness;
      }

      if (createdBy) {
        whereClause.createdBy = createdBy;
      }

      if (majorId) {
        whereClause.detailMajorTopics = {
          some: {
            majorId: majorId
          }
        };
      }

      if (search) {
        whereClause.OR = [
          { name: { contains: search } },
          { description: { contains: search } },
          { topicCode: { contains: search } }
        ];
      }

      console.log("Final whereClause:", JSON.stringify(whereClause, null, 2));

      // Truy vấn không ràng buộc để xem có topics nào trong DB không
      const allTopicsCount = await prisma.topic.count();
      console.log("Total topics in DB (ignoring filters):", allTopicsCount);
      
      if (allTopicsCount === 0) {
        console.log("No topics in DB at all");
        return {
          data: [],
          pagination: {
            page,
            pageSize,
            totalItems: 0,
            totalPages: 0,
            hasNext: false,
            hasPrevious: false
          }
        };
      }

      // Đếm tổng số đề tài theo điều kiện lọc
      const totalTopics = await prisma.topic.count({
        where: whereClause
      });
      
      console.log("Total topics count with filters:", totalTopics);

      // Lấy đề tài có phân trang
      const topics = await prisma.topic.findMany({
        where: whereClause,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true
            }
          },
          subMentor: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true
            }
          },
          semester: {
            select: {
              id: true,
              code: true,
              year: {
                select: {
                  id: true,
              year: true
                }
              }
            }
          },
          detailMajorTopics: {
            include: {
              major: true
            }
          },
          topicRegistrations: {
            select: {
              id: true,
              status: true,
              submissionPeriod: {
                select: {
                  id: true,
                  round: true,
                  startDate: true,
                  endDate: true,
                  status: true
                }
              }
            },
            take: 1
          },
          topicDocuments: {
            select: {
              id: true,
              fileName: true,
              documentUrl: true,
              uploadedAt: true,
              uploader: {
                select: {
                  id: true,
                  fullName: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      console.log("Topics found:", topics.length);

      // Tính toán thông tin phân trang
      const totalPages = Math.ceil(totalTopics / pageSize);
      const hasNext = page < totalPages;
      const hasPrevious = page > 1;

    return {
      data: topics,
        pagination: {
          page,
          pageSize,
          totalItems: totalTopics,
          totalPages,
          hasNext,
          hasPrevious
        }
      };
    } catch (error) {
      console.error('Error in getAllTopics:', error);
      throw error;
    }
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
              user: { connect: { id: mentorId } },
              role: 'REVIEWER',
              status: 'PENDING',
              assignedAt: new Date(),
              semesterId: registration.topic.semesterId
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

  async getTopicDetail(id: string, isOfficial?: boolean) {
    try {
      if (!this.isValidUuid(id)) {
        throw new Error(TOPIC_MESSAGE.INVALID_ID);
      }

      // Tạo điều kiện lọc theo loại đề tài nếu có
      let whereClause: any = { id };

      if (isOfficial !== undefined) {
        // Đề tài chính thức được tạo bởi academic_officer không qua TopicRegistration
        // Đề xuất đề tài được tạo bởi mentor qua TopicRegistration
        if (isOfficial) {
          // Tìm người dùng với vai trò academic_officer
          const academicOfficers = await prisma.userRole.findMany({
            where: {
              role: {
                name: 'academic_officer'
              }
            },
            select: {
              userId: true
            }
          });

          const academicOfficerIds = academicOfficers.map(officer => officer.userId);
          whereClause.createdBy = { in: academicOfficerIds };
        } else {
          // Tìm người dùng với vai trò mentor
          const mentors = await prisma.userRole.findMany({
            where: {
              role: {
                name: 'mentor'
              }
            },
            select: {
              userId: true
            }
          });

          const mentorIds = mentors.map(mentor => mentor.userId);
          whereClause.createdBy = { in: mentorIds };

          // Thêm điều kiện cho đề xuất đề tài
          whereClause.topicRegistrations = {
            some: {}
          };
        }
      }

      const topic = await prisma.topic.findFirst({
        where: whereClause,
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true,
              roles: {
                include: {
                  role: true
                }
              }
            }
          },
          subMentor: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true
            }
          },
          semester: {
            select: {
              id: true,
              code: true,
              startDate: true,
              endDate: true,
              year: {
                select: {
                  id: true,
                  year: true
                }
              }
            }
          },
          detailMajorTopics: {
            include: {
              major: true
            }
          },
          topicRegistrations: {
            include: {
              submissionPeriod: true
            }
          },
          topicDocuments: {
        select: {
          id: true,
          fileName: true,
              documentUrl: true,
          uploadedAt: true,
          uploader: {
            select: {
                  id: true,
                  fullName: true
                }
              }
            }
          },
          topicAssignments: {
            include: {
              group: {
                include: {
                  members: {
                    include: {
                      student: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!topic) {
        throw new Error(TOPIC_MESSAGE.TOPIC_NOT_FOUND);
      }

      return {
        id: topic.id,
        topicCode: topic.topicCode,
        name: topic.name,
        description: topic.description,
        isBusiness: topic.isBusiness,
        businessPartner: topic.businessPartner,
        status: topic.status,
        createdAt: topic.createdAt,
        updatedAt: topic.updatedAt,
        creator: {
          id: topic.creator.id,
          username: topic.creator.username,
          fullName: topic.creator.fullName,
          email: topic.creator.email,
          roles: topic.creator.roles.map(r => r.role.name)
        },
        subMentor: topic.subMentor ? {
          id: topic.subMentor.id,
          username: topic.subMentor.username,
          fullName: topic.subMentor.fullName,
          email: topic.subMentor.email
        } : null,
        semester: {
          id: topic.semester.id,
          code: topic.semester.code,
          startDate: topic.semester.startDate,
          endDate: topic.semester.endDate,
          year: topic.semester.year.year
        },
        majors: topic.detailMajorTopics.map(detail => ({
          id: detail.major.id,
          name: detail.major.name
        })),
        documents: topic.topicDocuments.map(doc => ({
          id: doc.id,
          fileName: doc.fileName,
          documentUrl: doc.documentUrl,
          uploadedAt: doc.uploadedAt,
          uploader: {
            id: doc.uploader.id,
            fullName: doc.uploader.fullName
          }
        })),
        registration: topic.topicRegistrations.length > 0 ? {
          id: topic.topicRegistrations[0].id,
          status: topic.topicRegistrations[0].status,
          submissionPeriod: {
            id: topic.topicRegistrations[0].submissionPeriod.id,
            round: topic.topicRegistrations[0].submissionPeriod.round,
            startDate: topic.topicRegistrations[0].submissionPeriod.startDate,
            endDate: topic.topicRegistrations[0].submissionPeriod.endDate,
            status: topic.topicRegistrations[0].submissionPeriod.status
          }
        } : null,
        assignments: topic.topicAssignments.map(assignment => ({
          id: assignment.id,
          group: {
            id: assignment.group.id,
            groupCode: assignment.group.groupCode,
            members: assignment.group.members.map(member => ({
              id: member.id,
              student: member.student ? {
                id: member.student.id,
                studentCode: member.student.studentCode
              } : null
            }))
          },
          status: assignment.status
        }))
      };
    } catch (error) {
      console.error('Error in getTopicDetail:', error);
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

  private isValidUuid(id: string): boolean {
    console.log("Validating UUID:", id);
    try {
      // Nếu id là rỗng hoặc không được định nghĩa, trả về false
      if (!id) {
        console.log("UUID is empty or undefined");
        return false;
      }
      
      // Kiểm tra xem có phải là UUID hợp lệ hay không
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isValid = uuidPattern.test(id);
      console.log("UUID validation result:", isValid);
      return isValid;
    } catch (error) {
      console.error("Error in isValidUuid:", error);
      return false;
    }
  }

  /**
   * Lấy danh sách các đề tài có thể chọn (đã được phê duyệt và chưa được gán cho nhóm nào)
   * @param semesterId ID của học kỳ
   * @param majorId ID của ngành học (tùy chọn)
   * @param page Số trang
   * @param pageSize Kích thước trang
   * @returns Danh sách các đề tài có thể chọn
   */
  async getAvailableTopics({
    semesterId,
    majorId,
    page = 1,
    pageSize = 10,
    search
  }: {
    semesterId: string;
    majorId?: string;
    page?: number;
    pageSize?: number;
    search?: string;
  }) {
    try {
      // Kiểm tra tính hợp lệ của semesterId
      if (!this.isValidUuid(semesterId)) {
        throw new Error('ID học kỳ không hợp lệ');
      }

      // Kiểm tra tính hợp lệ của majorId nếu có
      if (majorId && !this.isValidUuid(majorId)) {
        throw new Error('ID ngành học không hợp lệ');
      }

      // Xây dựng điều kiện tìm kiếm
      const whereCondition: any = {
        semesterId,
        status: 'APPROVED', // Chỉ lấy các đề tài đã được phê duyệt
        topicAssignments: {
          none: {} // Chỉ lấy các đề tài chưa được gán cho nhóm nào
        }
      };

      // Thêm điều kiện tìm kiếm theo ngành học nếu có
      if (majorId) {
        whereCondition.detailMajorTopics = {
          some: {
            majorId
          }
        };
      }

      // Thêm điều kiện tìm kiếm theo từ khóa nếu có
      if (search) {
        whereCondition.OR = [
          { name: { contains: search } },
          { description: { contains: search } },
          { topicCode: { contains: search } }
        ];
      }

      // Đếm tổng số đề tài thỏa mãn điều kiện
      const totalCount = await prisma.topic.count({
        where: whereCondition
      });

      // Tính toán phân trang
      const skip = (page - 1) * pageSize;
      const totalPages = Math.ceil(totalCount / pageSize);

      // Lấy danh sách đề tài
      const topics = await prisma.topic.findMany({
        where: whereCondition,
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true
            }
          },
          subMentor: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true
            }
          },
          detailMajorTopics: {
            include: {
              major: true
            }
          },
          topicDocuments: {
            select: {
              id: true,
              fileName: true,
              documentUrl: true
            }
          }
        },
        skip,
        take: pageSize,
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Định dạng kết quả trả về
      const formattedTopics = topics.map(topic => ({
        id: topic.id,
        topicCode: topic.topicCode,
        name: topic.name,
        description: topic.description,
        isBusiness: topic.isBusiness,
        businessPartner: topic.businessPartner,
        status: topic.status,
        createdAt: topic.createdAt,
        creator: topic.creator,
        subMentor: topic.subMentor,
        majors: topic.detailMajorTopics.map(detail => ({
          id: detail.major.id,
          name: detail.major.name
        })),
        documents: topic.topicDocuments.map(doc => ({
          id: doc.id,
          fileName: doc.fileName,
          documentUrl: doc.documentUrl
        }))
      }));

      return {
        data: formattedTopics,
        pagination: {
          totalCount,
          totalPages,
          currentPage: page,
          pageSize
        }
      };
    } catch (error) {
      console.error('Error in getAvailableTopics:', error);
      throw error;
    }
  }

  /**
   * Cho phép nhóm chọn một đề tài đã được phê duyệt
   * @param data Dữ liệu để chọn đề tài
   * @returns Thông tin về việc gán đề tài
   */
  async selectTopicForGroup(data: {
    topicId: string;
    groupId: string;
    userId: string;
  }) {
    const { topicId, groupId, userId } = data;

    // Kiểm tra tính hợp lệ của topicId và groupId
    if (!this.isValidUuid(topicId) || !this.isValidUuid(groupId)) {
      throw new Error('ID đề tài hoặc ID nhóm không hợp lệ');
    }

    // Kiểm tra topic có tồn tại không và có trạng thái APPROVED không
    const topic = await prisma.topic.findUnique({
      where: { 
        id: topicId,
        status: 'APPROVED'
      }
    });

    if (!topic) {
      throw new Error('Đề tài không tồn tại hoặc chưa được phê duyệt');
    }

    // Kiểm tra topic đã được gán cho nhóm nào chưa
    const existingTopicAssignment = await prisma.topicAssignment.findFirst({
      where: { topicId }
    });

    if (existingTopicAssignment) {
      throw new Error('Đề tài này đã được gán cho một nhóm khác');
    }

    // Kiểm tra group có tồn tại không
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      throw new Error('Không tìm thấy nhóm');
    }

    // Kiểm tra group đã được gán đề tài nào chưa
    const existingGroupAssignment = await prisma.topicAssignment.findFirst({
      where: { groupId }
    });

    if (existingGroupAssignment) {
      throw new Error('Nhóm này đã được gán đề tài khác');
    }

    // Kiểm tra người dùng có phải là thành viên của nhóm không
    const isMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        isActive: true
      }
    });

    if (!isMember) {
      throw new Error('Bạn không phải là thành viên của nhóm này');
    }

    // Kiểm tra người dùng có phải là leader của nhóm không
    const isLeader = isMember.role === 'LEADER';
    if (!isLeader) {
      throw new Error('Chỉ trưởng nhóm mới có thể chọn đề tài cho nhóm');
    }

    // Tạo topic assignment
    const topicAssignment = await prisma.topicAssignment.create({
      data: {
        topicId,
        groupId,
        assignedBy: userId,
        approvalStatus: 'PENDING',
        defendStatus: 'NOT_STARTED',
        status: 'ASSIGNED'
      }
    });

    // Log hành động
    await this.logSystemAction(
      'SELECT_TOPIC',
      topicId,
      `Nhóm ${groupId} đã chọn đề tài ${topicId}`,
      userId
    );

    return {
      id: topicAssignment.id,
      topicId: topicAssignment.topicId,
      groupId: topicAssignment.groupId,
      status: topicAssignment.status,
      approvalStatus: topicAssignment.approvalStatus,
      defendStatus: topicAssignment.defendStatus,
      assignedAt: topicAssignment.assignedAt
    };
  }
} 