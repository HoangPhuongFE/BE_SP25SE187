import { PrismaClient } from '@prisma/client';
import { MESSAGES } from '../constants/message';
import { AIService as CoreAIService } from '../ai/ai.service';

const prisma = new PrismaClient();
const aiService = new CoreAIService();

export class AIService {
  // Khởi tạo và train model
  async initializeAndTrainModel() {
    try {
      // Cập nhật cấu hình AI
      aiService.updateConfig({
        enabled: true,
        provider: 'gemini'
      });
      
      return { success: true, message: "Model đã được khởi tạo thành công" };
    } catch (error) {
      console.error('Lỗi khi khởi tạo model:', error);
      return { success: false, message: "Lỗi khi khởi tạo model" };
    }
  }

  // Kiểm tra tính hợp lệ của mã đề tài
  async validateTopicCode(topicCode: string, semesterId: string, majorId: string): Promise<{ isValid: boolean; message: string }> {
    try {
      // 1. Kiểm tra định dạng mã đề tài (SP25SE007)
      const codePattern = /^(SP|SU|FA)(\d{2})(SE|AI)(\d{3})$/;
      if (!codePattern.test(topicCode)) {
        return {
          isValid: false,
          message: "Mã đề tài phải có định dạng: [SP/SU/FA][Năm 2 số][SE/AI][3 số] (ví dụ: SP25SE007)"
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
      const [, seasonCode, yearCode, majorCode] = topicCode.match(codePattern) || [];
      
      // Kiểm tra mùa học có khớp với học kỳ không
      const semesterSeason = semester.code.substring(0, 2);
      if (seasonCode !== semesterSeason) {
        return {
          isValid: false,
          message: `Mã đề tài không khớp với học kỳ hiện tại (${semester.code})`
        };
      }

      // Kiểm tra năm có khớp với học kỳ không
      const semesterYear = semester.code.substring(2, 4);
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1; // getMonth() trả về 0-11
      const currentYear = currentDate.getFullYear().toString().slice(-2);
      
      // Nếu tháng hiện tại là 11 hoặc 12, cho phép tạo mã cho năm sau
      const allowedYear = (currentMonth >= 11 && parseInt(yearCode) === parseInt(currentYear) + 1) 
        ? (parseInt(currentYear) + 1).toString().padStart(2, '0')
        : currentYear;

      if (yearCode !== allowedYear) {
        return {
          isValid: false,
          message: `Năm trong mã đề tài (${yearCode}) không hợp lệ. Năm hiện tại là ${currentYear}${currentMonth >= 11 ? ` và có thể tạo mã cho năm ${allowedYear}` : ''}`
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
    } catch (error) {
      console.error('Lỗi khi kiểm tra mã đề tài:', error);
      return {
        isValid: false,
        message: "Lỗi hệ thống khi kiểm tra mã đề tài"
      };
    }
  }

  // Kiểm tra tính hợp lệ của tên đề tài
  async validateTopicName(nameVi: string, nameEn: string, nameProject: string): Promise<{ isValid: boolean; message: string }> {
    try {
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
      const aiResult = await aiService.validateTopicName(nameVi, "");
      
      if (!aiResult.isValid) {
        return {
          isValid: false,
          message: MESSAGES.TOPIC.INVALID_TOPIC_NAME + aiResult.message
        };
      }

      return { isValid: true, message: "Tên đề tài hợp lệ" };
    } catch (error) {
      console.error('Lỗi khi kiểm tra tên đề tài:', error);
      return {
        isValid: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi khi kiểm tra tên đề tài"
      };
    }
  }

  // Kiểm tra tính hợp lệ của mã nhóm
  async validateGroupCode(groupCode: string, semesterId: string): Promise<{ isValid: boolean; message: string }> {
    try {
      // Kiểm tra định dạng mã nhóm (3 chữ cái + 2 số + 2 chữ cái + số)
      const codePattern = /^[A-Z]{3}\d{2}[A-Z]{2}\d+$/;
      if (!codePattern.test(groupCode)) {
        return {
          isValid: false,
          message: "Mã nhóm phải có định dạng: 3 chữ cái + 2 số + 2 chữ cái + số (ví dụ: ABC12DE1)"
        };
      }

      // Kiểm tra trùng lặp mã nhóm trong cùng học kỳ
      const existingGroup = await prisma.group.findFirst({
        where: {
          groupCode,
          semesterId
        }
      });

      if (existingGroup) {
        return {
          isValid: false,
          message: "Mã nhóm đã tồn tại trong học kỳ này"
        };
      }

      return { isValid: true, message: "Mã nhóm hợp lệ" };
    } catch (error) {
      console.error('Lỗi khi kiểm tra mã nhóm:', error);
      return {
        isValid: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi khi kiểm tra mã nhóm"
      };
    }
  }

  // Kiểm tra toàn bộ thông tin đề tài
  async validateTopic(topicCode: string, topicName: string, description: string, groupCode: string, semesterId: string): Promise<{ isValid: boolean; message: string }> {
    try {
      const [codeResult, nameResult, groupResult] = await Promise.all([
        this.validateTopicCode(topicCode, semesterId, ""),
        this.validateTopicName(topicName, "", ""),
        this.validateGroupCode(groupCode, semesterId)
      ]);

      if (!codeResult.isValid || !nameResult.isValid || !groupResult.isValid) {
        const messages = [];
        if (!codeResult.isValid) messages.push(codeResult.message);
        if (!nameResult.isValid) messages.push(nameResult.message);
        if (!groupResult.isValid) messages.push(groupResult.message);

        return {
          isValid: false,
          message: messages.join(", ")
        };
      }

      // Kiểm tra với AI
      const aiResult = await aiService.validateTopic(topicName, description);
      if (!aiResult.isValid) {
        return {
          isValid: false,
          message: aiResult.message
        };
      }

      return { isValid: true, message: "Tất cả thông tin hợp lệ" };
    } catch (error) {
      console.error('Lỗi khi kiểm tra thông tin đề tài:', error);
      return {
        isValid: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi hệ thống"
      };
    }
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

      return {
        isValid: discrepancies.length === 0,
        message: discrepancies.length === 0 
          ? "Thông tin phân công đề tài chính xác" 
          : "Phát hiện một số không khớp trong thông tin phân công",
        discrepancies
      };
    } catch (error) {
      console.error('Lỗi khi kiểm tra quyết định phân công:', error);
      return {
        isValid: false,
        message: MESSAGES.TOPIC.AI_VALIDATION_FAILED + "Lỗi khi kiểm tra quyết định phân công"
      };
    }
  }
} 