// src/services/interMajorTopic.service.ts

import { PrismaClient } from '@prisma/client';
import HTTP_STATUS from '../constants/httpStatus';
import { GROUP_MESSAGE } from '../constants/message';
import { AIService } from '../services/ai.service';
import path from 'path';

const prisma = new PrismaClient();

export class InterMajorTopicService {
  private aiService = new AIService();

  // Tạo topic liên ngành
async createInterMajorTopic(data: {
  nameVi: string;
  nameEn: string;
  description: string;
  semesterId: string;
  majorPairConfigId: string;
  submissionPeriodId: string;
  createdBy: string;
  isBusiness?: boolean;
  businessPartner?: string;
  source?: string;
  draftFileUrl?: string;
  draftFileName?: string;
  groupId?: string;
  groupCode?: string;
}) {
  try {
    const { nameVi, nameEn, description, semesterId, majorPairConfigId, submissionPeriodId, createdBy } = data;

    if (!semesterId || !submissionPeriodId || !createdBy || !majorPairConfigId) {
      return {
        success: false,
        status: HTTP_STATUS.BAD_REQUEST,
        message: 'Thiếu thông tin bắt buộc!',
      };
    }

    // Validate học kỳ
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId, isDeleted: false },
      select: { id: true, code: true },
    });
    if (!semester || !semester.code) {
      return {
        success: false,
        status: HTTP_STATUS.NOT_FOUND,
        message: 'Học kỳ không tồn tại!',
      };
    }

    // Validate MajorPairConfig
    const majorPairConfig = await prisma.majorPairConfig.findUnique({
      where: { id: majorPairConfigId },
      include: {
        firstMajor: { select: { id: true, name: true } },
        secondMajor: { select: { id: true, name: true } },
      },
    });
    if (!majorPairConfig || !majorPairConfig.isActive) {
      return {
        success: false,
        status: HTTP_STATUS.NOT_FOUND,
        message: 'Cấu hình liên ngành không hợp lệ!',
      };
    }

    const major1 = majorPairConfig.firstMajor;
    const major2 = majorPairConfig.secondMajor;

    // Validate submissionPeriod
    const submissionPeriod = await prisma.submissionPeriod.findUnique({
      where: { id: submissionPeriodId, isDeleted: false },
      select: { id: true },
    });
    if (!submissionPeriod) {
      return {
        success: false,
        status: HTTP_STATUS.NOT_FOUND,
        message: 'Đợt xét duyệt không hợp lệ!',
      };
    }

    // Validate tên đề tài bằng AI
    const aiValidation = await this.aiService.validateTopicName(
      nameVi,
      nameEn,
      undefined,
      { skipDatabaseCheck: true, semesterId }
    );
    if (!aiValidation.isValid) {
      return {
        success: false,
        status: HTTP_STATUS.BAD_REQUEST,
        message: aiValidation.message,
      };
    }

    // Generate topicCode
    const semesterCode = semester.code.toUpperCase();
    const majorCode1 = major1.name.split(' ').map(word => word[0]).join('').toUpperCase();
    const majorCode2 = major2.name.split(' ').map(word => word[0]).join('').toUpperCase();
    const topicCount = await prisma.topic.count({ where: { semesterId } });
    const topicCode = `${majorCode1}-${majorCode2}-${semesterCode}-${(topicCount + 1).toString().padStart(3, '0')}`;

    // Xử lý group nếu có groupCode
    let groupIdToUse = data.groupId;
    if (!groupIdToUse && data.groupCode) {
      const group = await prisma.group.findUnique({
        where: { semesterId_groupCode: { semesterId, groupCode: data.groupCode } },
        select: { id: true, isMultiMajor: true },
      });
      if (!group || !group.isMultiMajor) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: 'Nhóm không tồn tại hoặc không phải nhóm liên ngành!',
        };
      }
      groupIdToUse = group.id;
    }

    const isBusiness = data.isBusiness === true;

    // Tạo đề tài liên ngành
    const newTopic = await prisma.topic.create({
      data: {
        topicCode,
        nameVi,
        nameEn,
        description,
        semesterId,
        submissionPeriodId,
        createdBy,
        name: nameVi,
        isBusiness,
        businessPartner: data.businessPartner,
        source: data.source,
        proposedGroupId: groupIdToUse,
        majorPairConfigId,
        majors: { connect: [{ id: major1.id }, { id: major2.id }] },
        status: 'PENDING',
        mainSupervisor: createdBy, // Gán mainSupervisor là createdBy
      },
    });

    // Ghi log hệ thống
    await prisma.systemLog.create({
      data: {
        userId: createdBy,
        action: 'CREATE_INTER_MAJOR_TOPIC',
        entityType: 'topic',
        entityId: newTopic.id,
        description: 'Đề tài liên ngành đã được tạo thành công',
        severity: 'INFO',
        ipAddress: '::1',
      },
    });

    const confidence = aiValidation.similarity || 0.9;

    return {
      success: true,
      status: HTTP_STATUS.CREATED,
      message: `Đề tài đã được tạo thành công (mức độ phù hợp: ${(confidence * 100).toFixed(2)}%)`,
      data: newTopic,
    };

  } catch (error) {
    console.error('Lỗi tạo topic liên ngành:', error);
    await prisma.systemLog.create({
      data: {
        userId: 'system',
        action: 'CREATE_INTER_MAJOR_TOPIC_ERROR',
        entityType: 'topic',
        entityId: 'N/A',
        description: 'Lỗi khi tạo đề tài liên ngành',
        severity: 'ERROR',
        ipAddress: '::1',
      },
    });
    return {
      success: false,
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: 'Lỗi hệ thống khi tạo đề tài liên ngành.',
    };
  }
}




  // --- API Tạo topic liên ngành có mentor ---
  async createInterMajorTopicWithMentors(data: {
    nameVi: string;
    nameEn: string;
    description: string;
    semesterId: string;
    majorPairConfigId: string;
    submissionPeriodId: string;
    createdBy: string;
    mainMentorId?: string;
    subMentorId?: string;
    groupId?: string;
    groupCode?: string;
    isBusiness?: boolean;
    businessPartner?: string;
    source?: string;
    draftFileUrl?: string;
    draftFileName?: string;
  }) {
    try {
      const { semesterId, submissionPeriodId, createdBy, majorPairConfigId } = data;

      if (!semesterId || !submissionPeriodId || !createdBy || !majorPairConfigId) {
        return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: 'Thiếu thông tin bắt buộc!' };
      }

      const semester = await prisma.semester.findUnique({
        where: { id: semesterId, isDeleted: false },
        select: { code: true },
      });
      if (!semester?.code) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Học kỳ không tồn tại!' };
      }

      const majorPairConfig = await prisma.majorPairConfig.findUnique({
        where: { id: majorPairConfigId },
        include: {
          firstMajor: { select: { id: true, name: true } },
          secondMajor: { select: { id: true, name: true } },
        },
      });
      if (!majorPairConfig || !majorPairConfig.isActive) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Cấu hình liên ngành không hợp lệ!' };
      }

      const submissionPeriod = await prisma.submissionPeriod.findUnique({
        where: { id: submissionPeriodId, isDeleted: false },
        select: { semesterId: true },
      });
      if (!submissionPeriod || submissionPeriod.semesterId !== semesterId) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Đợt xét duyệt không hợp lệ!' };
      }

      const nameValidation = await this.aiService.validateTopicName(data.nameVi, data.nameEn, undefined, {
        skipDatabaseCheck: true,
        semesterId,
      });
      if (!nameValidation.isValid) {
        return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: nameValidation.message };
      }

      const semesterCode = semester.code.toUpperCase();
      const majorCode1 = majorPairConfig.firstMajor.name.split(' ').map(w => w[0]).join('').toUpperCase();
      const majorCode2 = majorPairConfig.secondMajor.name.split(' ').map(w => w[0]).join('').toUpperCase();
      const topicCount = await prisma.topic.count({ where: { semesterId } });
      const topicCode = `${majorCode1}-${majorCode2}-${semesterCode}-${(topicCount + 1).toString().padStart(3, '0')}`;

      let mainMentorId: string | null = null;
      if (data.mainMentorId) {
        const mentor = await prisma.user.findUnique({ where: { email: data.mainMentorId }, select: { id: true } });
        if (!mentor) return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Mentor chính không hợp lệ!' };
        mainMentorId = mentor.id;
      }

      let subMentorId: string | null = null;
      if (data.subMentorId) {
        const mentor = await prisma.user.findUnique({ where: { email: data.subMentorId }, select: { id: true } });
        if (!mentor) return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Mentor phụ không hợp lệ!' };
        subMentorId = mentor.id;
      }

      let groupIdToUse = data.groupId;
      if (!groupIdToUse && data.groupCode) {
        const group = await prisma.group.findUnique({
          where: { semesterId_groupCode: { semesterId, groupCode: data.groupCode } },
          select: { id: true, isMultiMajor: true },
        });
        if (!group || !group.isMultiMajor) {
          return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: 'Nhóm không tồn tại hoặc không phải nhóm liên ngành!' };
        }
        groupIdToUse = group.id;
      }

      const newTopic = await prisma.topic.create({
        data: {
          topicCode,
          nameVi: data.nameVi,
          nameEn: data.nameEn,
          description: data.description,
          semesterId,
          submissionPeriodId,
          createdBy,
          name: data.nameVi,
          isBusiness: data.isBusiness || false,
          businessPartner: data.businessPartner,
          source: data.source,
          proposedGroupId: groupIdToUse,
          majorPairConfigId,
          majors: { connect: [{ id: majorPairConfig.firstMajor.id }, { id: majorPairConfig.secondMajor.id }] },
          mainSupervisor: mainMentorId,
          subSupervisor: subMentorId,
          status: 'APPROVED',
        },
      });

      if (data.draftFileUrl) {
        await prisma.document.create({
          data: {
            fileName: data.draftFileName || 'Draft File',
            fileUrl: data.draftFileUrl,
            fileType: data.draftFileName ? path.extname(data.draftFileName) : '',
            uploadedBy: createdBy,
            topicId: newTopic.id,
            documentType: 'draft',
          },
        });
      }

      const mentorMainRole = await prisma.role.findUnique({ where: { name: 'mentor_main' } });
      const mentorSubRole = await prisma.role.findUnique({ where: { name: 'mentor_sub' } });

      if (groupIdToUse && mainMentorId && mentorMainRole) {
        await prisma.groupMentor.upsert({
          where: { groupId_mentorId: { groupId: groupIdToUse, mentorId: mainMentorId } },
          update: {},
          create: {
            groupId: groupIdToUse,
            mentorId: mainMentorId,
            roleId: mentorMainRole.id,
            addedBy: createdBy,
          },
        });
      }

      if (groupIdToUse && subMentorId && mentorSubRole) {
        await prisma.groupMentor.upsert({
          where: { groupId_mentorId: { groupId: groupIdToUse, mentorId: subMentorId } },
          update: {},
          create: {
            groupId: groupIdToUse,
            mentorId: subMentorId,
            roleId: mentorSubRole.id,
            addedBy: createdBy,
          },
        });
      }

      await prisma.topicAssignment.create({
        data: {
          topicId: newTopic.id,
          groupId: groupIdToUse!,
          assignedBy: createdBy,
          approvalStatus: 'APPROVED',
          defendStatus: 'NOT_SCHEDULED',
          status: 'ASSIGNED',
        },
      });

      await prisma.systemLog.create({
        data: {
          userId: createdBy,
          action: 'CREATE_INTER_MAJOR_TOPIC_WITH_MENTORS',
          entityType: 'topic',
          entityId: newTopic.id,
          description: 'Tạo đề tài liên ngành và gán mentor thành công',
          severity: 'INFO',
          ipAddress: '::1',
        },
      });

      const confidence = nameValidation.similarity || 0.9;
      return {
        success: true,
        status: HTTP_STATUS.CREATED,
        message: `Đề tài liên ngành đã tạo thành công (mức độ phù hợp: ${(confidence * 100).toFixed(2)}%)`,
        data: newTopic,
      };
    } catch (error) {
      console.error('Lỗi tạo đề tài liên ngành with mentors:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi hệ thống khi tạo đề tài.' };
    }
  }
}

