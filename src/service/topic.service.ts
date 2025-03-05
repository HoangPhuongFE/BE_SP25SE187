import { PrismaClient } from '@prisma/client';
import { TOPIC_MESSAGE, GROUP_MESSAGE } from '../constants/message';
import HTTP_STATUS from '../constants/httpStatus';
import crypto from 'crypto';
import cloudinary from '../config/cloudinary';
import ExcelJS from 'exceljs';

const prisma = new PrismaClient();

export class TopicService {
  async createTopic(data: {
    nameVi: string;
    nameEn: string;
    description: string;
    semesterId: string;
    majorId: string;
    isBusiness?: boolean | string;
    businessPartner?: string;
    source?: string;
    subSupervisor?: string;
    subSupervisorEmail?: string;
    name: string;
    createdBy: string;
    draftFileUrl?: string; 
    groupId?: string;
    groupCode?: string;
  }) {
    try {
      if (!data.semesterId || !data.createdBy) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: !data.semesterId ? 'Thiếu `semesterId`!' : 'Thiếu `createdBy`!',
        };
      }

      const semester = await prisma.semester.findUnique({ where: { id: data.semesterId } });
      if (!semester) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: TOPIC_MESSAGE.SEMESTER_REQUIRED };
      }

      const major = await prisma.major.findUnique({ where: { id: data.majorId } });
      if (!major) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: TOPIC_MESSAGE.INVALID_MAJOR };
      }

      const submissionPeriod = await prisma.submissionPeriod.findFirst({
        where: { semesterId: data.semesterId, OR: [{ status: 'ACTIVE' }, { endDate: { gte: new Date() } }] },
        orderBy: { startDate: 'asc' },
        select: { id: true, status: true },
      });
      if (!submissionPeriod) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy đợt xét duyệt phù hợp!' };
      }

      let subSupervisorId = data.subSupervisor;
      if (!subSupervisorId && data.subSupervisorEmail) {
        const mentor = await prisma.user.findUnique({ where: { email: data.subSupervisorEmail }, select: { id: true } });
        if (!mentor) {
          return { success: false, status: HTTP_STATUS.NOT_FOUND, message: TOPIC_MESSAGE.INVALID_REVIEWER };
        }
        subSupervisorId = mentor.id;
      }

      const isBusiness = data.isBusiness !== undefined ? data.isBusiness === 'true' || data.isBusiness === true : true;

      const currentYear = new Date().getFullYear().toString().slice(-2);
      const majorCode = major.name.slice(0, 2).toUpperCase();
      const topicCount = await prisma.topic.count({ where: { semesterId: data.semesterId } });
      const topicCode = `${majorCode}-${currentYear}-${(topicCount + 1).toString().padStart(3, '0')}`;

      let groupIdToUse: string | undefined = data.groupId;
      if (!groupIdToUse && data.groupCode) {
        const group = await prisma.group.findUnique({
          where: { groupCode: data.groupCode },
          select: { id: true, groupCode: true },
        });
        if (!group) {
          return { success: false, status: HTTP_STATUS.NOT_FOUND, message: GROUP_MESSAGE.GROUP_NOT_FOUND };
        }
        groupIdToUse = group.id;
      } else if (groupIdToUse) {
        const group = await prisma.group.findUnique({
          where: { id: groupIdToUse },
          select: { id: true, groupCode: true },
        });
        if (!group) {
          return { success: false, status: HTTP_STATUS.NOT_FOUND, message: GROUP_MESSAGE.GROUP_NOT_FOUND };
        }
      }

      const newTopic = await prisma.topic.create({
        data: {
          topicCode,
          nameVi: data.nameVi,
          nameEn: data.nameEn,
          description: data.description,
          semesterId: data.semesterId,
          submissionPeriodId: submissionPeriod.id,
          isBusiness,
          businessPartner: data.businessPartner,
          source: data.source,
          subSupervisor: subSupervisorId,
          createdBy: data.createdBy,
          status: 'PENDING',
          name: data.name,
          proposedGroupId: groupIdToUse,
        },
      });

      let decision;
      if (data.draftFileUrl) {
        decision = await prisma.decision.create({
          data: {
            decisionNumber: `QD-DRAFT-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 4)}`,
            decisionTitle: `Đề xuất đề tài ${newTopic.topicCode}`,
            topicId: newTopic.id,
            draftFileUrl: data.draftFileUrl,
            status: 'PENDING',
            createdBy: data.createdBy,
            groupId: groupIdToUse || null, 
          },
        });
      }

      if (groupIdToUse) {
        await prisma.groupMentor.create({
          data: {
            groupId: groupIdToUse,
            mentorId: data.createdBy,
            addedBy: data.createdBy,
          },
        });
      }

      return {
        success: true,
        status: HTTP_STATUS.CREATED,
        message: TOPIC_MESSAGE.TOPIC_CREATED,
        data: { topic: newTopic, decision },
      };
    } catch (error) {
      console.error('Lỗi khi tạo đề tài:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi hệ thống khi tạo đề tài.' };
    }
  }


  async updateTopic(
    topicId: string,
    data: {
      nameVi?: string;
      nameEn?: string;
      name?: string;
      description?: string;
      isBusiness?: boolean;
      businessPartner?: string;
      source?: string;
      subSupervisor?: string;
      subSupervisorEmail?: string;
      groupId?: string;
      groupCode?: string;
      updatedBy: string;
      documents?: { fileName: string; fileUrl: string; fileType: string }[];
    }
  ) {
    try {
      const existingTopic = await prisma.topic.findUnique({
        where: { id: topicId },
        select: { status: true, proposedGroupId: true },
      });
      if (!existingTopic) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: TOPIC_MESSAGE.TOPIC_NOT_FOUND };
      }

      let updatedGroupId = data.groupId;
      if (!updatedGroupId && data.groupCode) {
        const group = await prisma.group.findUnique({
          where: { groupCode: data.groupCode },
          select: { id: true },
        });
        if (!group) {
          return { success: false, status: HTTP_STATUS.NOT_FOUND, message: GROUP_MESSAGE.GROUP_NOT_FOUND };
        }
        updatedGroupId = group.id;
      }

      let updatedSubSupervisorId = data.subSupervisor ?? null;
      if (!updatedSubSupervisorId && data.subSupervisorEmail) {
        const mentor = await prisma.user.findUnique({
          where: { email: data.subSupervisorEmail },
          select: { id: true },
        });
        if (!mentor) {
          return { success: false, status: HTTP_STATUS.NOT_FOUND, message: TOPIC_MESSAGE.INVALID_REVIEWER };
        }
        updatedSubSupervisorId = mentor.id;
      }

      const updatedTopic = await prisma.topic.update({
        where: { id: topicId },
        data: {
          nameVi: data.nameVi,
          nameEn: data.nameEn,
          name: data.name,
          description: data.description,
          isBusiness: data.isBusiness,
          businessPartner: data.businessPartner,
          source: data.source,
          subSupervisor: updatedSubSupervisorId,
          updatedAt: new Date(),
          proposedGroupId: updatedGroupId || existingTopic.proposedGroupId,
        },
      });

      if (data.documents && data.documents.length > 0) {
        await prisma.document.deleteMany({ where: { topicId } });
        await prisma.document.createMany({
          data: data.documents.map((doc) => ({
            fileName: doc.fileName,
            fileUrl: doc.fileUrl,
            fileType: doc.fileType,
            uploadedBy: data.updatedBy,
            topicId,
            uploadedAt: new Date(),
          })),
        });
      }

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: TOPIC_MESSAGE.TOPIC_UPDATED,
        data: updatedTopic,
      };
    } catch (error) {
      console.error('Lỗi khi cập nhật đề tài:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: TOPIC_MESSAGE.ACTION_FAILED };
    }
  }

  async getTopicsBySemester(semesterId: string) {
    try {
      const topics = await prisma.topic.findMany({
        where: { semesterId },
        select: {
          id: true,
          topicCode: true,
          nameVi: true,
          nameEn: true,
          description: true,
          status: true,
          createdAt: true,
          submissionPeriodId: true,
          subMentor: { select: { fullName: true, email: true } },
          creator: { select: { fullName: true, email: true } },
          proposedGroupId: true,
        },
      });
      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: 'Lấy danh sách đề tài thành công.',
        data: topics,
      };
    } catch (error) {
      console.error('Lỗi khi lấy danh sách đề tài:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi khi lấy danh sách đề tài.' };
    }
  }

  async getTopicById(topicId: string) {
    try {
      const topic = await prisma.topic.findUnique({
        where: { id: topicId },
        include: {
          creator: { select: { fullName: true, email: true } },
          subMentor: { select: { fullName: true, email: true } },
          group: { select: { id: true, groupCode: true } },
          topicAssignments: { include: { group: { select: { id: true, groupCode: true } } } },
          documents: { select: { fileName: true, fileUrl: true, fileType: true } },
        },
      });
      if (!topic) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy đề tài.' };
      }
      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: 'Lấy thông tin đề tài thành công.',
        data: topic,
      };
    } catch (error) {
      console.error('Lỗi khi lấy thông tin đề tài:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi khi lấy thông tin đề tài.' };
    }
  }

  async approveTopicByAcademic(topicId: string, status: 'APPROVED' | 'REJECTED', userId: string, finalFile?: Express.Multer.File) {
    try {
      if (!['APPROVED', 'REJECTED'].includes(status)) {
        return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: 'Trạng thái không hợp lệ!' };
      }

      const topic = await prisma.topic.findUnique({
        where: { id: topicId },
        include: { topicRegistrations: true, group: true },
      });
      if (!topic || topic.status !== 'PENDING') {
        return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: 'Đề tài không hợp lệ hoặc đã được duyệt!' };
      }

      const updatedTopic = await prisma.topic.update({
        where: { id: topicId },
        data: { status },
      });

      let decision = await prisma.decision.findFirst({ where: { topicId } });
      if (status === 'APPROVED') {
        let finalFileUrl;
        if (finalFile) {
          const uploadResult = await cloudinary.uploader.upload(finalFile.path, {
            resource_type: 'auto',
            folder: 'decisions/final',
            public_id: `final-${topic.topicCode}-${crypto.randomUUID().slice(0, 8)}`,
          });
          finalFileUrl = uploadResult.secure_url;
        }

        if (decision) {
          decision = await prisma.decision.update({
            where: { id: decision.id },
            data: { status: 'APPROVED', finalFileUrl },
          });
        } else {
          decision = await prisma.decision.create({
            data: {
              decisionNumber: `QD-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 4)}`,
              decisionTitle: `Phê duyệt đề tài ${topic.topicCode}`,
              topicId,
              status: 'APPROVED',
              createdBy: userId,
              finalFileUrl,
              groupId: topic.proposedGroupId || '', // groupId là bắt buộc trong schema
            },
          });
        }

        if (topic.proposedGroupId && topic.group) {
          await prisma.topicAssignment.create({
            data: {
              topicId,
              groupId: topic.proposedGroupId,
              assignedBy: userId,
              approvalStatus: 'APPROVED',
              defendStatus: 'NOT_SCHEDULED',
              status: 'ASSIGNED',
            },
          });
          await prisma.topic.update({
            where: { id: topicId },
            data: { proposedGroupId: null },
          });
        }
      } else if (status === 'REJECTED') {
        if (decision) {
          await prisma.decision.update({
            where: { id: decision.id },
            data: { status: 'REJECTED' },
          });
        }
        await prisma.topic.update({
          where: { id: topicId },
          data: { proposedGroupId: null },
        });
      }

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: `Đề tài đã được ${status === 'APPROVED' ? 'duyệt' : 'từ chối'}.`,
        data: { topic: updatedTopic, decision },
      };
    } catch (error) {
      console.error('Lỗi khi duyệt đề tài:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi hệ thống khi duyệt đề tài.' };
    }
  }

  async registerTopic(data: { topicId?: string; topicCode?: string }, leaderId: string) {
    const { topicId, topicCode } = data;

    if (!topicId && !topicCode) {
      return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: 'Thiếu topicId hoặc topicCode để đăng ký!' };
    }

    const leader = await prisma.groupMember.findFirst({
      where: {
        OR: [
          { userId: leaderId },
          { studentId: (await prisma.student.findUnique({ where: { userId: leaderId } }))?.id },
        ],
        role: 'leader',
      },
      select: { groupId: true },
    });

    if (!leader) {
      console.log(`❌ User ${leaderId} không phải leader của bất kỳ nhóm nào`);
      return { success: false, status: HTTP_STATUS.FORBIDDEN, message: 'Bạn không phải là trưởng nhóm!' };
    }

    let topic;
    if (topicId) {
      topic = await prisma.topic.findUnique({
        where: { id: topicId },
        select: { id: true, status: true, topicAssignments: true, submissionPeriodId: true, topicCode: true, proposedGroupId: true },
      });
    } else if (topicCode) {
      topic = await prisma.topic.findUnique({
        where: { topicCode },
        select: { id: true, status: true, topicAssignments: true, submissionPeriodId: true, topicCode: true, proposedGroupId: true },
      });
    }

    if (!topic) {
      return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Đề tài không tồn tại!' };
    }

    if (topic.status !== 'APPROVED') {
      return { success: false, status: HTTP_STATUS.FORBIDDEN, message: 'Đề tài chưa được duyệt!' };
    }

    if (topic.topicAssignments.length > 0) {
      return { success: false, status: HTTP_STATUS.FORBIDDEN, message: 'Đề tài đã được gán cho nhóm khác!' };
    }

    if (topic.proposedGroupId) {
      return { success: false, status: HTTP_STATUS.FORBIDDEN, message: 'Đề tài đã được mentor đề xuất gán cho nhóm khác!' };
    }

    const existingRegistration = await prisma.topicRegistration.findFirst({
      where: { topicId: topic.id, userId: leaderId },
    });

    if (existingRegistration) {
      return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: 'Nhóm của bạn đã đăng ký đề tài này!' };
    }

    const registration = await prisma.topicRegistration.create({
      data: {
        topicId: topic.id,
        userId: leaderId,
        submissionPeriodId: topic.submissionPeriodId || '',
        role: 'leader',
        status: 'PENDING',
        registeredAt: new Date(),
      },
    });

    return {
      success: true,
      status: HTTP_STATUS.CREATED,
      message: 'Đăng ký đề tài thành công! Chờ mentor duyệt.',
      data: registration,
    };
  }

  async approveTopicRegistrationByMentor(registrationId: string, data: { status: 'APPROVED' | 'REJECTED'; reason?: string }, userId: string) {
    try {
      if (!['APPROVED', 'REJECTED'].includes(data.status)) {
        return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: 'Trạng thái không hợp lệ!' };
      }

      const registration = await prisma.topicRegistration.findUnique({
        where: { id: registrationId },
        include: { topic: { select: { id: true, createdBy: true, submissionPeriodId: true, status: true, proposedGroupId: true } } },
      });

      if (!registration) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy đăng ký đề tài!' };
      }

      if (registration.topic.createdBy !== userId) {
        return { success: false, status: HTTP_STATUS.FORBIDDEN, message: 'Chỉ mentor tạo đề tài mới có quyền duyệt!' };
      }

      if (registration.topic.status !== 'APPROVED') {
        return { success: false, status: HTTP_STATUS.FORBIDDEN, message: 'Đề tài chưa được duyệt!' };
      }

      if (registration.status !== 'PENDING') {
        return { success: false, status: HTTP_STATUS.FORBIDDEN, message: 'Chỉ có thể duyệt đăng ký ở trạng thái PENDING!' };
      }

      const updatedRegistration = await prisma.topicRegistration.update({
        where: { id: registrationId },
        data: {
          status: data.status,
          decisionFile: data.reason || null,
          reviewedAt: new Date(),
          reviewerId: userId,
        },
      });

      if (data.status === 'REJECTED') {
        return { success: true, status: HTTP_STATUS.OK, message: 'Đã từ chối đăng ký đề tài!', data: updatedRegistration };
      }

      const student = await prisma.student.findFirst({
        where: { userId: registration.userId },
        select: { id: true },
      });

      const leaderGroup = await prisma.groupMember.findFirst({
        where: { OR: [{ studentId: student?.id }, { userId: registration.userId }], role: 'leader' },
        select: { groupId: true },
      });

      if (!leaderGroup) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy nhóm của leader!' };
      }

      const existingAssignment = await prisma.topicAssignment.findFirst({
        where: { topicId: registration.topicId },
      });

      if (!existingAssignment) {
        await prisma.topicAssignment.create({
          data: {
            topicId: registration.topicId,
            groupId: leaderGroup.groupId,
            assignedBy: userId,
            approvalStatus: 'APPROVED',
            defendStatus: 'NOT_SCHEDULED',
            status: 'ASSIGNED',
          },
        });

        await prisma.groupMentor.upsert({
          where: { groupId_mentorId: { groupId: leaderGroup.groupId, mentorId: userId } },
          update: {},
          create: { groupId: leaderGroup.groupId, mentorId: userId, addedBy: userId },
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: registration.userId },
        select: { fullName: true, email: true },
      });

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: 'Duyệt đăng ký đề tài thành công!',
        data: { ...updatedRegistration, user },
      };
    } catch (error) {
      console.error('Lỗi khi duyệt đăng ký đề tài:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi hệ thống khi duyệt đăng ký đề tài.' };
    }
  }

  async deleteTopic(topicId: string) {
    try {
      const topic = await prisma.topic.findUnique({
        where: { id: topicId },
        select: { status: true, topicAssignments: true, proposedGroupId: true },
      });
      if (!topic) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy đề tài!' };
      }

      if (topic.status !== 'PENDING') {
        return { success: false, status: HTTP_STATUS.FORBIDDEN, message: 'Chỉ có thể xóa đề tài ở trạng thái PENDING!' };
      }

      if (topic.topicAssignments.length > 0 || topic.proposedGroupId) {
        return { success: false, status: HTTP_STATUS.FORBIDDEN, message: 'Không thể xóa đề tài đã có nhóm đề xuất hoặc đăng ký!' };
      }

      await prisma.topic.delete({ where: { id: topicId } });
      return { success: true, status: HTTP_STATUS.OK, message: 'Xóa đề tài thành công!' };
    } catch (error) {
      console.error('Lỗi khi xóa đề tài:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi khi xóa đề tài!' };
    }
  }

  async getTopicsForApprovalBySubmission(query: { submissionPeriodId?: string; round?: number; semesterId?: string }) {
    try {
      let submissionPeriodId: string;
      if (query.submissionPeriodId) {
        submissionPeriodId = query.submissionPeriodId;
        const submissionPeriod = await prisma.submissionPeriod.findUnique({ where: { id: submissionPeriodId } });
        if (!submissionPeriod) {
          return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy đợt xét duyệt!' };
        }
      } else if (query.round !== undefined && query.semesterId) {
        const semester = await prisma.semester.findUnique({ where: { id: query.semesterId } });
        if (!semester) {
          return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy học kỳ!' };
        }
        const submissionPeriod = await prisma.submissionPeriod.findFirst({
          where: { semesterId: query.semesterId, roundNumber: query.round },
        });
        if (!submissionPeriod) {
          return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy đợt xét duyệt!' };
        }
        submissionPeriodId = submissionPeriod.id;
      } else {
        return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: 'Thiếu thông tin cần thiết!' };
      }

      const topics = await prisma.topic.findMany({
        where: { submissionPeriodId, status: 'PENDING' },
        include: {
          group: { select: { groupCode: true, id: true } },
          decisions: { select: { draftFileUrl: true } },
        },
      });

      if (topics.length === 0) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy đề tài nào!' };
      }

      return {
        success: true,
        status: HTTP_STATUS.OK,
        data: topics,
      };
    } catch (error) {
      console.error('Lỗi khi lấy danh sách đề tài:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi hệ thống!' };
    }
  }

  async exportTopicsToExcel(topics: any[]) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Topics');
      worksheet.columns = [
        { header: 'Mã đề tài', key: 'topicCode', width: 15 },
        { header: 'Tên (VN)', key: 'nameVi', width: 30 },
        { header: 'Tên (EN)', key: 'nameEn', width: 30 },
        { header: 'File nháp', key: 'draftFileUrl', width: 50 },
      ];

      topics.forEach(topic => {
        worksheet.addRow({
          topicCode: topic.topicCode,
          nameVi: topic.nameVi,
          nameEn: topic.nameEn,
          draftFileUrl: topic.decisions[0]?.draftFileUrl || '',
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return {
        success: true,
        status: HTTP_STATUS.OK,
        data: buffer,
      };
    } catch (error) {
      console.error('Lỗi khi xuất Excel:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi hệ thống khi xuất Excel!' };
    }
  }

  async getAvailableTopics(filter: { semesterId: string; status?: string }) {
    const { semesterId, status } = filter;

    if (!semesterId) {
      return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: 'Thiếu `semesterId`!' };
    }

    const topics = await prisma.topic.findMany({
      where: { semesterId, status: status || 'APPROVED' },
      select: {
        id: true,
        topicCode: true,
        nameVi: true,
        nameEn: true,
        description: true,
        status: true,
        createdAt: true,
        proposedGroupId: true,
        topicAssignments: { select: { id: true, groupId: true } },
      },
    });

    if (topics.length === 0) {
      return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy đề tài khả dụng!' };
    }

    return { success: true, status: HTTP_STATUS.OK, message: 'Lấy danh sách đề tài thành công!', data: topics };
  }

  async getRegisteredTopicsByMentor(mentorId: string) {
    try {
      const registeredTopics = await prisma.topic.findMany({
        where: { createdBy: mentorId, topicRegistrations: { some: { status: 'APPROVED' } } },
        select: {
          id: true,
          topicCode: true,
          nameVi: true,
          nameEn: true,
          description: true,
          status: true,
          createdAt: true,
          subSupervisor: true,           // Thêm subSupervisor
          reviewReason: true,            // Thêm reviewReason
          isBusiness: true,              // Thêm isBusiness
          businessPartner: true,         // Thêm businessPartner
          proposedGroupId: true,         // Thêm proposedGroupId
          submissionPeriodId: true,      // Thêm submissionPeriodId
          subMentor: {                   // Thêm thông tin subMentor từ quan hệ
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          topicRegistrations: {
            select: { id: true, status: true, registeredAt: true, userId: true, topicId: true },
          },
        },
      });
  
      const userIds = [...new Set(registeredTopics.flatMap(topic => topic.topicRegistrations.map(reg => reg.userId)))];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true, email: true },
      });
  
      const topicIds = registeredTopics.map(topic => topic.id);
      const groupAssignments = await prisma.topicAssignment.findMany({
        where: { topicId: { in: topicIds } },
        select: { topicId: true, group: { select: { id: true, groupCode: true } } },
      });
  
      const topicsWithUsers = registeredTopics.map(topic => ({
        ...topic,
        topicRegistrations: topic.topicRegistrations.map(reg => ({
          ...reg,
          user: users.find(user => user.id === reg.userId) || null,
          group: groupAssignments.find(group => group.topicId === topic.id)?.group || null,
        })),
      }));
  
      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: 'Lấy danh sách đề tài đã đăng ký thành công!',
        data: topicsWithUsers,
      };
    } catch (error) {
      console.error('Lỗi khi lấy danh sách đề tài đã đăng ký:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi hệ thống!' };
    }
  }



  async downloadDecisionFile(decisionId: string, fileType: string) {
    try {
      const decision = await prisma.decision.findUnique({ where: { id: decisionId } });
      if (!decision) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy quyết định!' };
      }

      const fileUrl = fileType === 'draft' ? decision.draftFileUrl : decision.finalFileUrl;
      if (!fileUrl) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: `Không có file ${fileType}!` };
      }

      return { success: true, status: HTTP_STATUS.OK, data: fileUrl };
    } catch (error) {
      console.error('Lỗi khi tải file:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi hệ thống khi tải file!' };
    }
  }
}