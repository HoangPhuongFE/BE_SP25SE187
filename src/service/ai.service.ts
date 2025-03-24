import { PrismaClient } from '@prisma/client';
import { MESSAGES } from '../constants/message';
import { AIService as CoreAIService } from '../ai/ai.core';

const prisma = new PrismaClient();

export class AIService {
  private aiService: CoreAIService;

  constructor() {
    this.aiService = new CoreAIService();
    // Khởi tạo AI với TensorFlow mặc định
    this.initializeAI();
  }

  // Khởi tạo AI với TensorFlow
  private async initializeAI() {
    try {
      // Cập nhật cấu hình AI
      this.aiService.updateConfig({
        enabled: true,
        provider: 'tensorflow'
      });

      // Train model nếu có đủ dữ liệu
      const trainingTopics = await prisma.topic.findMany({
        where: {
          isDeleted: false,
          status: 'APPROVED'
        },
        select: {
          nameVi: true,
          nameEn: true,
          name: true,
          description: true,
          status: true
        }
      });

      if (trainingTopics.length >= 10) {
        const trainingData = {
          topics: trainingTopics.map(topic => ({
            nameVi: topic.nameVi,
            nameEn: topic.nameEn,
            nameProject: topic.name,
            description: topic.description,
            isValid: topic.status === 'APPROVED'
          }))
        };

        // Lấy provider và train
        const provider = this.aiService.getProvider();
        if (provider) {
          await provider.train(trainingData);
          console.log('AI đã được khởi tạo và train thành công với TensorFlow');
        }
      } else {
        console.log('Chưa đủ dữ liệu để train model (cần ít nhất 10 đề tài đã duyệt)');
      }
    } catch (error) {
      console.error('Lỗi khi khởi tạo AI:', error);
    }
  }

  // Hàm tiện ích để ghi log AI validation
  private async logAIValidation(action: string, entityType: string, entityId: string, result: { isValid: boolean; message: string }, metadata?: any) {
    try {
      // Tạo system user nếu chưa tồn tại
      let systemUser = await prisma.user.findFirst({
        where: {
          username: 'system'
        }
      });

      if (!systemUser) {
        systemUser = await prisma.user.create({
          data: {
            username: 'system',
            email: 'system@localhost',
            passwordHash: 'system',
            isActive: true
          }
        });
      }

      // Ghi log với system user
      await prisma.systemLog.create({
        data: {
          userId: systemUser.id,
          action: action,
          entityType: entityType,
          entityId: entityId,
          description: result.message,
          severity: result.isValid ? 'INFO' : 'WARNING',
          metadata: metadata ? metadata : null,
          ipAddress: '::1'
        }
      });
    } catch (error) {
      // Log lỗi nhưng không throw để không ảnh hưởng đến luồng chính
      console.error('Lỗi khi ghi log AI validation:', error);
    }
  }

  // Kiểm tra tính hợp lệ của mã đề tài
  async validateTopicCode(topicCode: string, semesterId: string, majorId: string): Promise<{ isValid: boolean; message: string }> {
    try {
      const result = await this._validateTopicCode(topicCode, semesterId, majorId);
      
      // Ghi log
      await this.logAIValidation(
        'VALIDATE_TOPIC_CODE',
        'topic',
        topicCode,
        result,
        { semesterId, majorId }
      );

      return result;
    } catch (error) {
      console.error('Lỗi khi kiểm tra mã đề tài:', error);
      return {
        isValid: false,
        message: "Lỗi hệ thống khi kiểm tra mã đề tài"
      };
    }
  }

  // Logic kiểm tra mã đề tài thực tế
  private async _validateTopicCode(topicCode: string, semesterId: string, majorId: string): Promise<{ isValid: boolean; message: string }> {
    // 1. Kiểm tra định dạng mã đề tài (SE-SPRING2025-004)
    const codePattern = /^(SE|AI)-((SPRING|SUMMER|FALL)\d{4})-(\d{3})$/;
    if (!codePattern.test(topicCode)) {
      return {
        isValid: false,
        message: "Mã đề tài phải có định dạng: [SE/AI]-[SPRING/SUMMER/FALL][Năm 4 số]-[3 số] (ví dụ: SE-SPRING2025-004)"
      };
    }

    // 2. Kiểm tra xem mã có phù hợp với học kỳ không
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId }
    });

    if (!semester) {
      return {
        isValid: false,
        message: "Không tìm thấy học kỳ"
      };
    }

    // Lấy thông tin từ mã đề tài
    const [, majorCode, semesterPart] = topicCode.match(codePattern) || [];
    const seasonYear = semesterPart.match(/^(SPRING|SUMMER|FALL)(\d{4})$/);
    
    if (!seasonYear) {
      return {
        isValid: false,
        message: "Định dạng học kỳ trong mã đề tài không hợp lệ"
      };
    }

    const [, season, year] = seasonYear;

    // Kiểm tra mùa học có khớp với học kỳ không
    const semesterSeason = semester.code.substring(0, 2).toUpperCase() as 'SP' | 'SU' | 'FA';
    const seasonMap: Record<'SP' | 'SU' | 'FA', string> = {
      'SP': 'SPRING',
      'SU': 'SUMMER',
      'FA': 'FALL'
    };
    
    if (season !== seasonMap[semesterSeason]) {
      return {
        isValid: false,
        message: `Mã đề tài không khớp với học kỳ hiện tại (${semester.code})`
      };
    }

    // Kiểm tra năm có hợp lệ không
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const yearNum = parseInt(year);
    
    if (yearNum < currentYear || yearNum > currentYear + 1) {
      return {
        isValid: false,
        message: `Năm trong mã đề tài phải là năm hiện tại hoặc năm sau (${currentYear} hoặc ${currentYear + 1})`
      };
    }

    // 3. Kiểm tra xem mã có phù hợp với chuyên ngành không
    const major = await prisma.major.findUnique({
      where: { id: majorId }
    });

    if (!major) {
      return {
        isValid: false,
        message: "Không tìm thấy chuyên ngành"
      };
    }

    // Kiểm tra mã ngành có khớp không
    const majorCodeInDB = major.name === 'Software Engineering' ? 'SE' : 'AI';
    if (majorCode !== majorCodeInDB) {
      return {
        isValid: false,
        message: `Mã ngành trong mã đề tài (${majorCode}) không khớp với chuyên ngành (${majorCodeInDB})`
      };
    }

    // 4. Kiểm tra số thứ tự có hợp lệ không
    const sequenceNumber = parseInt(topicCode.slice(-3));
    if (sequenceNumber < 1 || sequenceNumber > 999) {
      return {
        isValid: false,
        message: "Số thứ tự phải từ 001 đến 999"
      };
    }

    // 5. Kiểm tra trùng lặp mã đề tài trong cùng học kỳ và ngành
    const existingTopic = await prisma.topic.findFirst({
      where: { 
        topicCode,
        semesterId,
        majors: {
          some: {
            id: majorId
          }
        }
      }
    });

    if (existingTopic) {
      return {
        isValid: false,
        message: "Mã đề tài đã tồn tại trong học kỳ này"
      };
    }

    return { 
      isValid: true, 
      message: "Mã đề tài hợp lệ" 
    };
  }

  // Kiểm tra tính hợp lệ của tên đề tài
  async validateTopicName(nameVi: string, nameEn: string, nameProject: string): Promise<{ isValid: boolean; message: string }> {
    try {
      const result = await this._validateTopicName(nameVi, nameEn, nameProject);
      
      // Ghi log
      await this.logAIValidation(
        'VALIDATE_TOPIC_NAME',
        'topic',
        `${nameVi}|${nameEn}|${nameProject}`,
        result,
        { nameVi, nameEn, nameProject }
      );

      return result;
    } catch (error) {
      console.error('Lỗi khi kiểm tra tên đề tài:', error);
      return {
        isValid: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi khi kiểm tra tên đề tài"
      };
    }
  }

  // Logic kiểm tra tên đề tài thực tế
  private async _validateTopicName(nameVi: string, nameEn: string, nameProject: string): Promise<{ isValid: boolean; message: string }> {
    // Kiểm tra độ dài tối thiểu và tối đa
    if (nameVi.length < 10 || nameVi.length > 200 || 
        nameEn.length < 10 || nameEn.length > 200 || 
        nameProject.length < 10 || nameProject.length > 200) {
      return {
        isValid: false,
        message: "Tên đề tài phải có độ dài từ 10-200 ký tự"
      };
    }

    // Kiểm tra trùng lặp chính xác từng ký tự
    const existingTopic = await prisma.topic.findFirst({
      where: {
        OR: [
          { nameVi },
          { nameEn },
          { name: nameProject }
        ]
      }
    });

    if (existingTopic) {
      const duplicateFields = [];
      if (existingTopic.nameVi === nameVi) duplicateFields.push("tên tiếng Việt");
      if (existingTopic.nameEn === nameEn) duplicateFields.push("tên tiếng Anh");
      if (existingTopic.name === nameProject) duplicateFields.push("tên dự án");

      return {
        isValid: false,
        message: `Đề tài đã tồn tại với ${duplicateFields.join(", ")}`
      };
    }

    // Kiểm tra với AI
    const aiResult = await this.aiService.validateTopicName(nameVi, nameEn, nameProject);
    
    if (!aiResult.isValid) {
      return {
        isValid: false,
        message: MESSAGES.TOPIC.INVALID_TOPIC_NAME + aiResult.message
      };
    }

    return { isValid: true, message: "Tên đề tài hợp lệ" };
  }

  // Kiểm tra tính hợp lệ của mã nhóm
  async validateGroupCode(groupCode: string, semesterId: string): Promise<{ isValid: boolean; message: string }> {
    try {
      const result = await this._validateGroupCode(groupCode, semesterId);
      
      // Ghi log
      await this.logAIValidation(
        'VALIDATE_GROUP_CODE',
        'group',
        groupCode,
        result,
        { semesterId }
      );

      return result;
    } catch (error) {
      console.error('Lỗi khi kiểm tra mã nhóm:', error);
      return {
        isValid: false,
        message: "Lỗi hệ thống khi kiểm tra mã nhóm"
      };
    }
  }

  // Logic kiểm tra mã nhóm thực tế
  private async _validateGroupCode(groupCode: string, semesterId: string): Promise<{ isValid: boolean; message: string }> {
    // Kiểm tra định dạng mã nhóm (G25SE001)
    const codePattern = /^G(\d{2})(SE|AI)(\d{3})$/;
    if (!codePattern.test(groupCode)) {
      return {
        isValid: false,
        message: "Mã nhóm phải có định dạng: G[2 số][SE/AI][3 số] (ví dụ: G25SE001)"
      };
    }

    // Lấy thông tin từ mã nhóm
    const [, yearCode, majorCode, sequence] = groupCode.match(codePattern) || [];

    // Kiểm tra năm có hợp lệ không
    const currentYear = new Date().getFullYear() % 100; // Lấy 2 số cuối của năm hiện tại
    const groupYear = parseInt(yearCode);
    
    if (groupYear < currentYear || groupYear > currentYear + 1) {
      return {
        isValid: false,
        message: `Năm trong mã nhóm phải là năm hiện tại hoặc năm sau (${currentYear} hoặc ${currentYear + 1})`
      };
    }

    // Kiểm tra số thứ tự
    const sequenceNumber = parseInt(sequence);
    if (sequenceNumber < 1 || sequenceNumber > 999) {
      return {
        isValid: false,
        message: "Số thứ tự nhóm phải từ 001 đến 999"
      };
    }


    return { isValid: true, message: "Mã nhóm hợp lệ" };
  }

  // Kiểm tra toàn bộ thông tin đề tài
  async validateTopic(topicCode: string, nameVi: string, nameEn: string, nameProject: string, description: string, groupCode: string | null, semesterId: string, majorId: string): Promise<{ isValid: boolean; message: string }> {
    try {
      const result = await this._validateTopic(topicCode, nameVi, nameEn, nameProject, description, groupCode, semesterId, majorId);
      
      // Ghi log
      await this.logAIValidation(
        'VALIDATE_TOPIC',
        'topic',
        topicCode,
        result,
        {
          nameVi,
          nameEn,
          nameProject,
          description,
          groupCode,
          semesterId,
          majorId
        }
      );

      return result;
    } catch (error) {
      console.error('Lỗi khi kiểm tra thông tin đề tài:', error);
      return {
        isValid: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi hệ thống"
      };
    }
  }

  // Logic kiểm tra toàn bộ thông tin đề tài thực tế
  private async _validateTopic(topicCode: string, nameVi: string, nameEn: string, nameProject: string, description: string, groupCode: string | null, semesterId: string, majorId: string): Promise<{ isValid: boolean; message: string }> {
    // 1. Kiểm tra mã đề tài, tên đề tài
    const [codeResult, nameResult] = await Promise.all([
      this._validateTopicCode(topicCode, semesterId, majorId),
      this._validateTopicName(nameVi, nameEn, nameProject)
    ]);

    const messages = [];
    if (!codeResult.isValid) messages.push(codeResult.message);
    if (!nameResult.isValid) messages.push(nameResult.message);

    // 2. Nếu có mã nhóm, kiểm tra nhóm
    if (groupCode) {
      // Kiểm tra nhóm có tồn tại không và có đề tài chưa
      const existingGroup = await prisma.group.findFirst({
        where: {
          groupCode,
          semesterId,
          isDeleted: false
        },
        include: {
          topicAssignments: {
            where: {
              isDeleted: false,
              approvalStatus: {
                in: ['PENDING', 'APPROVED']
              }
            },
            include: {
              topic: true
            }
          }
        }
      });

      if (!existingGroup) {
        messages.push(`Không tìm thấy nhóm ${groupCode} trong học kỳ này`);
      } else if (existingGroup.topicAssignments.length > 0) {
        const assignment = existingGroup.topicAssignments[0];
        messages.push(
          `Nhóm ${groupCode} đã được ${assignment.approvalStatus === 'APPROVED' ? 'phân công' : 'đăng ký'} cho đề tài ${assignment.topic.topicCode}`
        );
      }
    }

    if (messages.length > 0) {
      return {
        isValid: false,
        message: messages.join(", ")
      };
    }

    // 3. Kiểm tra nội dung đề tài với AI
    const aiResult = await this.aiService.validateTopic(nameVi, description);
    if (!aiResult.isValid) {
      return {
        isValid: false,
        message: aiResult.message
      };
    }

    return { isValid: true, message: "Tất cả thông tin hợp lệ" };
  }

  // Kiểm tra quyết định phân công đề tài
  async verifyAssignmentDecision(data: {
    groupCode: string;
    topicCode: string;
    semesterId: string;
  }): Promise<{ isValid: boolean; message: string; discrepancies?: any[] }> {
    try {
      const { groupCode, topicCode, semesterId } = data;
      const discrepancies = [];

      // 1. Kiểm tra nhóm tồn tại
      const group = await prisma.group.findUnique({
        where: { semesterId_groupCode: { semesterId, groupCode } },
        include: {
          members: {
            include: {
              student: true,
              role: true
            }
          }
        }
      });

      if (!group) {
        return {
          isValid: false,
          message: "Không tìm thấy nhóm với mã số này trong học kỳ"
        };
      }

      // 2. Kiểm tra đề tài tồn tại
      const topic = await prisma.topic.findUnique({
        where: { topicCode },
        include: {
          majors: true,
          topicAssignments: {
            include: {
              group: true
            }
          }
        }
      });

      if (!topic) {
        return {
          isValid: false,
          message: "Không tìm thấy đề tài với mã số này"
        };
      }

      // 3. Kiểm tra phân công đề tài
      const assignment = await prisma.topicAssignment.findFirst({
        where: {
          topicId: topic.id,
          groupId: group.id,
          approvalStatus: 'APPROVED'
        }
      });

      if (!assignment) {
        discrepancies.push({
          type: 'ASSIGNMENT',
          message: 'Đề tài chưa được phân công cho nhóm này trong hệ thống'
        });
      }

      // 4. Kiểm tra chuyên ngành
      const groupLeader = group.members.find(member => member.role.name === 'leader');
      if (groupLeader?.student && groupLeader.student.majorId !== topic.majors[0]?.id) {
        discrepancies.push({
          type: 'MAJOR',
          message: 'Chuyên ngành của trưởng nhóm không khớp với chuyên ngành của đề tài'
        });
      }

      // 5. Kiểm tra trạng thái đề tài
      if (topic.status !== 'APPROVED') {
        discrepancies.push({
          type: 'STATUS',
          message: `Đề tài đang ở trạng thái ${topic.status}, không phải APPROVED`
        });
      }

      // 6. Kiểm tra xem nhóm có đang được phân công cho đề tài khác không
      const otherAssignments = await prisma.topicAssignment.findMany({
        where: {
          groupId: group.id,
          approvalStatus: 'APPROVED',
          NOT: {
            topicId: topic.id
          }
        },
        include: {
          topic: true
        }
      });

      if (otherAssignments.length > 0) {
        discrepancies.push({
          type: 'MULTIPLE_ASSIGNMENTS',
          message: `Nhóm đang được phân công cho đề tài khác: ${otherAssignments[0].topic.topicCode}`
        });
      }

      // 7. Sử dụng AI để kiểm tra tính phù hợp của phân công
      const aiResult = await this.aiService.validateTopic(topic.nameVi, topic.description);
      if (!aiResult.isValid) {
        discrepancies.push({
          type: 'AI_VALIDATION',
          message: `AI đánh giá: ${aiResult.message}`,
          confidence: aiResult.confidence
        });
      }

      const result = {
        isValid: discrepancies.length === 0,
        message: discrepancies.length === 0 
          ? "Thông tin phân công đề tài chính xác" 
          : "Phát hiện một số không khớp trong thông tin phân công",
        discrepancies
      };

      // Ghi log kết quả kiểm tra
      await this.logAIValidation(
        'VERIFY_ASSIGNMENT_DECISION',
        'assignment',
        `${groupCode}_${topicCode}`,
        {
          isValid: result.isValid,
          message: result.message
        },
        {
          groupCode,
          topicCode,
          semesterId,
          discrepancies,
          aiValidation: aiResult
        }
      );

      return result;
    } catch (error) {
      console.error('Lỗi khi kiểm tra quyết định phân công:', error);
      return {
        isValid: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi khi kiểm tra quyết định phân công"
      };
    }
  }

  // Chuyển đổi loại AI
  async switchAIProvider(provider: 'tensorflow' | 'gemini' | 'none', apiKey?: string) {
    try {
      // Cập nhật cấu hình AI
      this.aiService.updateConfig({
        enabled: true,
        provider,
        apiKey
      });

      // Nếu là Gemini, kiểm tra API key
      if (provider === 'gemini' && !apiKey) {
        return {
          success: false,
          message: "API key là bắt buộc khi sử dụng Gemini"
        };
      }

      return {
        success: true,
        message: `Đã chuyển sang sử dụng ${provider === 'tensorflow' ? 'AI tự train' : provider === 'gemini' ? 'Gemini AI' : 'không sử dụng AI'}`
      };
    } catch (error) {
      console.error('Lỗi khi chuyển đổi AI provider:', error);
      return {
        success: false,
        message: "Lỗi khi chuyển đổi AI provider"
      };
    }
  }

  // Lấy thông tin cấu hình AI hiện tại
  async getAIConfig() {
    try {
      const config = this.aiService.getConfig();
      return {
        success: true,
        data: {
          enabled: config.enabled,
          provider: config.provider,
          isApiKeySet: !!config.apiKey
        }
      };
    } catch (error) {
      console.error('Lỗi khi lấy cấu hình AI:', error);
      return {
        success: false,
        message: "Lỗi khi lấy cấu hình AI"
      };
    }
  }

  // Retrain model AI
  async retrainModel(): Promise<{ success: boolean; message: string }> {
    try {
      // Lấy dữ liệu training từ database
      const trainingTopics = await prisma.topic.findMany({
        where: {
          isDeleted: false,
          status: 'APPROVED'
        },
        select: {
          nameVi: true,
          nameEn: true,
          name: true,
          description: true,
          status: true
        }
      });

      // Kiểm tra có đủ dữ liệu training không
      if (trainingTopics.length < 10) {
        return {
          success: false,
          message: "Cần ít nhất 10 đề tài đã duyệt để train model"
        };
      }

      // Chuẩn bị dữ liệu training
      const trainingData = {
        topics: trainingTopics.map(topic => ({
          nameVi: topic.nameVi,
          nameEn: topic.nameEn,
          nameProject: topic.name,
          description: topic.description,
          isValid: topic.status === 'APPROVED'
        }))
      };

      // Lấy provider hiện tại
      const provider = this.aiService.getProvider();
      if (!provider) {
        return {
          success: false,
          message: "Không tìm thấy AI provider"
        };
      }

      // Thực hiện train model
      const trainResult = await provider.train(trainingData);
      
      if (!trainResult.isValid) {
        return {
          success: false,
          message: "Lỗi khi train model: " + trainResult.message
        };
      }
      
      return { 
        success: true, 
        message: `Model đã được train thành công với ${trainingData.topics.length} đề tài. Độ chính xác: ${trainResult.confidence || 0}%` 
      };
    } catch (error) {
      console.error('Lỗi khi train model:', error);
      return { 
        success: false, 
        message: "Lỗi khi train model: " + (error instanceof Error ? error.message : String(error))
      };
    }
  }
} 