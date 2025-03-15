import { PrismaClient } from '@prisma/client';
import { TOPIC_MESSAGE, GROUP_MESSAGE } from '../constants/message';
import HTTP_STATUS from '../constants/httpStatus';


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

      const semester = await prisma.semester.findUnique({
        where: { id: data.semesterId },
        select: { id: true, status: true, startDate: true }
      });
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

      const isBusiness = data.isBusiness !== undefined
        ? data.isBusiness === 'true' || data.isBusiness === true
        : true;

      // Tạo topicCode dựa trên majorCode và năm hiện tại (có thể cập nhật sau nếu muốn dùng năm của học kỳ)
      const currentYear = new Date().getFullYear().toString().slice(-2);
      const majorCode = major.name.slice(0, 2).toUpperCase();
      const topicCount = await prisma.topic.count({ where: { semesterId: data.semesterId } });
      const topicCode = `${majorCode}-${currentYear}-${(topicCount + 1).toString().padStart(3, '0')}`;

      let groupIdToUse: string | undefined = data.groupId;
      if (!groupIdToUse && data.groupCode) {
        const group = await prisma.group.findUnique({
          where: { semesterId_groupCode: { semesterId: data.semesterId, groupCode: data.groupCode } },
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

      // Nếu có nhóm đính kèm, kiểm tra chuyên ngành của nhóm (lấy từ leader của nhóm) có trùng với đề tài không
      if (groupIdToUse) {
        // Lấy thông tin trưởng nhóm
        const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
        if (!leaderRole) {
          return {
            success: false,
            status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
            message: "Vai trò 'leader' không tồn tại.",
          };
        }
        const groupLeader = await prisma.groupMember.findFirst({
          where: { groupId: groupIdToUse, roleId: leaderRole.id },
          include: { student: true },
        });
        if (!groupLeader || !groupLeader.student) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: "Không tìm thấy thông tin sinh viên của trưởng nhóm.",
          };
        }
        if (groupLeader.student.majorId !== data.majorId) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: "Nhóm được chọn không cùng chuyên ngành với đề tài.",
          };
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

          // Nếu cần, có thể lưu thêm majorId cho đề tài (nếu model Topic có field này)
        },
      });

      let draftDocument;
      if (data.draftFileUrl) {
        draftDocument = await prisma.document.create({
          data: {
            fileName: 'Draft File', // Có thể tùy chỉnh tên file
            fileUrl: data.draftFileUrl,
            fileType: '', // Giả sử là PDF, có thể thay đổi
            uploadedBy: data.createdBy,
            topicId: newTopic.id,
            documentType: 'draft',
          },
        });
      }

      if (groupIdToUse) {
        const mentorRole = await prisma.role.findUnique({ where: { name: "mentor_main" } });
        if (!mentorRole) throw new Error("Vai trò mentor không tồn tại.");
        await prisma.groupMentor.create({
          data: {
            groupId: groupIdToUse,
            mentorId: data.createdBy,
            roleId: mentorRole.id,
            addedBy: data.createdBy,
          },
        });
      }

      return {
        success: true,
        status: HTTP_STATUS.CREATED,
        message: TOPIC_MESSAGE.TOPIC_CREATED,
        data: {
          topic: {
            ...newTopic,
            draftFileUrl: draftDocument?.fileUrl, // Thêm vào đây để trả ra ngoài response
          }
        },
      };
    } catch (error) {
      console.error('Lỗi khi tạo đề tài:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi hệ thống khi tạo đề tài.' };
    }
  }

  async registerTopic(data: { topicId?: string; topicCode?: string }, leaderId: string) {
    try {
      const { topicId, topicCode } = data;
      if (!topicId && !topicCode) {
        return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: 'Thiếu topicId hoặc topicCode để đăng ký!' };
      }

      const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
      if (!leaderRole) throw new Error("Vai trò 'leader' không tồn tại.");

      const leaderMembership = await prisma.groupMember.findFirst({
        where: {
          OR: [
            { userId: leaderId },
            { studentId: (await prisma.student.findUnique({ where: { userId: leaderId } }))?.id },
          ],
          roleId: leaderRole.id,
        },
        select: { groupId: true },
      });
      if (!leaderMembership) {
        console.log(`User ${leaderId} không phải leader của bất kỳ nhóm nào`);
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

      // Kiểm tra chuyên ngành của leader và đề tài (dựa trên topicCode)
      const leaderStudent = await prisma.student.findUnique({ where: { userId: leaderId } });
      if (!leaderStudent || !leaderStudent.majorId) {
        return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: 'Không tìm thấy thông tin chuyên ngành của bạn.' };
      }
      const leaderMajor = await prisma.major.findUnique({ where: { id: leaderStudent.majorId } });
      if (!leaderMajor) {
        return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: 'Không tìm thấy thông tin chuyên ngành của bạn.' };
      }
      // Giả sử topicCode được tạo theo định dạng "XX-YY-ZZZ", trong đó XX là mã chuyên ngành
      const topicMajorAbbr = topic.topicCode.split('-')[0];
      const leaderMajorAbbr = leaderMajor.name.slice(0, 2).toUpperCase();
      if (topicMajorAbbr !== leaderMajorAbbr) {
        return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: 'Đề tài không cùng chuyên ngành với nhóm của bạn!' };
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
    } catch (error) {
      console.error('Lỗi khi đăng ký đề tài:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi hệ thống khi đăng ký đề tài.' };
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
      semesterId?: string; // nếu cần để tìm group theo composite key
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
      if (!updatedGroupId && data.groupCode && data.semesterId) {
        const group = await prisma.group.findUnique({
          where: { semesterId_groupCode: { semesterId: data.semesterId, groupCode: data.groupCode } },
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
          name: true,
          description: true,
          isBusiness: true,
          businessPartner: true,
          source: true,
          subSupervisor: true,
          createdBy: true,
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

  async approveTopicByAcademic(
    topicId: string,
    status: 'APPROVED' | 'REJECTED' | 'IMPROVED',
    userId: string,
    reviewReason?: string
  ) {
    try {
      // Kiểm tra trạng thái hợp lệ
      if (!['APPROVED', 'REJECTED', 'IMPROVED'].includes(status)) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: 'Trạng thái không hợp lệ!',
        };
      }

      // Lấy đề tài cần duyệt, bao gồm trường group (nếu có)
      const topic = await prisma.topic.findUnique({
        where: { id: topicId },
        include: { group: true },
      });
      if (!topic || topic.status !== 'PENDING') {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: 'Đề tài không hợp lệ hoặc đã được duyệt!',
        };
      }

      // Cập nhật trạng thái đề tài và lưu reviewReason nếu có
      const updatedTopic = await prisma.topic.update({
        where: { id: topicId },
        data: { status, reviewReason: reviewReason || null },
      });

      if (status === 'APPROVED') {
        // Nếu đề tài được duyệt, cần tạo TopicAssignment nếu có proposedGroupId
        if (topic.proposedGroupId && topic.group) {
          // Tạo bản ghi TopicAssignment với các trạng thái:
          // approvalStatus: 'APPROVED', defendStatus: 'NOT_SCHEDULED', status: 'ASSIGNED'
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

          // Lấy thông tin người tạo đề tài để kiểm tra vai trò
          const creator = await prisma.user.findUnique({
            where: { id: topic.createdBy },
            select: { roles: { select: { role: true } } },
          });
          const isLecturer = creator?.roles.some(r => r.role.name.toLowerCase() === 'lecturer');

          // Nếu người tạo là lecturer, gán mentor_main và (nếu có) mentor_sub cho nhóm đề xuất
          if (isLecturer) {
            // Gán mentor_main cho nhóm (dùng createdBy của đề tài)
            const mentorMainRole = await prisma.role.findUnique({ where: { name: "mentor_main" } });
            if (!mentorMainRole) {
              throw new Error("Vai trò mentor_main không tồn tại.");
            }
            await prisma.groupMentor.upsert({
              where: { groupId_mentorId: { groupId: topic.proposedGroupId, mentorId: topic.createdBy } },
              update: {},
              create: {
                groupId: topic.proposedGroupId,
                mentorId: topic.createdBy,
                roleId: mentorMainRole.id,
                addedBy: userId,
              },
            });

            // Nếu đề tài có thông tin subSupervisor, gán mentor_sub cho nhóm
            if (topic.subSupervisor) {
              const mentorSubRole = await prisma.role.findUnique({ where: { name: "mentor_sub" } });
              if (!mentorSubRole) {
                throw new Error("Vai trò mentor_sub không tồn tại.");
              }
              await prisma.groupMentor.create({
                data: {
                  groupId: topic.proposedGroupId,
                  mentorId: topic.subSupervisor,
                  roleId: mentorSubRole.id,
                  addedBy: userId,
                },
              });
            }
          }
          // Sau khi tạo TopicAssignment và (nếu có) các bản ghi mentor, reset proposedGroupId
          await prisma.topic.update({
            where: { id: topicId },
            data: { proposedGroupId: null },
          });
        }
        // Nếu đề tài không có proposedGroupId, tức không gán nhóm, thì không tạo TopicAssignment.
      } else if (status === 'REJECTED') {
        // Nếu bị từ chối, reset proposedGroupId (nếu có)
        await prisma.topic.update({
          where: { id: topicId },
          data: { proposedGroupId: null },
        });
      } else if (status === 'IMPROVED') {
        // Nếu trạng thái là IMPROVED, chỉ reset proposedGroupId
        await prisma.topic.update({
          where: { id: topicId },
          data: { proposedGroupId: null },
        });
      }

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message:
          status === 'APPROVED'
            ? 'Đề tài đã được duyệt.'
            : status === 'REJECTED'
              ? 'Đề tài đã bị từ chối.'
              : 'Đề tài cần được cải thiện.',
        data: { topic: updatedTopic },
      };
    } catch (error) {
      console.error('Lỗi khi duyệt đề tài:', error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống khi duyệt đề tài.',
      };
    }
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

      const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
      if (!leaderRole) throw new Error("Vai trò 'leader' không tồn tại.");

      const leaderGroup = await prisma.groupMember.findFirst({
        where: {
          OR: [{ studentId: student?.id }, { userId: registration.userId }],
          roleId: leaderRole.id, // Thay role: 'leader' bằng roleId
        },
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
        const mentorRole = await prisma.role.findUnique({ where: { name: "mentor_main" } });
        if (!mentorRole) throw new Error("Vai trò mentor không tồn tại.");
        await prisma.groupMentor.upsert({
          where: { groupId_mentorId: { groupId: leaderGroup.groupId, mentorId: userId } },
          update: {},
          create: {
            groupId: leaderGroup.groupId,
            mentorId: userId,
            roleId: mentorRole.id, // Thêm roleId
            addedBy: userId,
          },
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


  async deleteTopic(topicId: string, isSystemWide: boolean, userId: string) {
    try {
      // Tìm đề tài theo topicId và lấy các trường cần thiết
      const topic = await prisma.topic.findUnique({
        where: { id: topicId },
        select: {
          status: true,
          createdBy: true,
          topicAssignments: true,
          topicRegistrations: true,
          proposedGroupId: true,
        },
      });

      if (!topic) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: 'Không tìm thấy đề tài!',
        };
      }

      // Nếu không có quyền system-wide, kiểm tra xem user có phải là người tạo đề tài hay không
      if (!isSystemWide && topic.createdBy !== userId) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: 'Chỉ người tạo đề tài mới được phép xóa!',
        };
      }

      // Nếu không có quyền system-wide, áp dụng các điều kiện ràng buộc khác
      if (!isSystemWide) {
        if (topic.status !== 'PENDING') {
          return {
            success: false,
            status: HTTP_STATUS.FORBIDDEN,
            message: 'Chỉ có thể xóa đề tài ở trạng thái PENDING!',
          };
        }
        if (
          topic.topicAssignments.length > 0 ||
          topic.topicRegistrations.length > 0 ||
          topic.proposedGroupId
        ) {
          return {
            success: false,
            status: HTTP_STATUS.FORBIDDEN,
            message: 'Không thể xóa đề tài đã có nhóm đăng ký hoặc đề xuất!',
          };
        }
      }

      // Xoá thủ công các bản ghi liên quan bằng transaction
      await prisma.$transaction(async (tx) => {
        await tx.topicRegistration.deleteMany({ where: { topicId } });
        await tx.topicAssignment.deleteMany({ where: { topicId } });
        await tx.decision.deleteMany({ where: { topicId } });
        await tx.document.deleteMany({ where: { topicId } });
        await tx.topic.delete({ where: { id: topicId } });
      });

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: 'Xóa đề tài thành công!',
      };
    } catch (error) {
      console.error('Lỗi khi xóa đề tài:', error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi khi xóa đề tài!',
      };
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





  async getTopicRegistrations(topicId: string, mentorId: string) {
    try {
      // **Kiểm tra đề tài**
      const topic = await prisma.topic.findUnique({
        where: { id: topicId },
        select: { status: true, createdBy: true },
      });

      if (!topic) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: 'Không tìm thấy đề tài!',
        };
      }

      if (topic.status !== 'APPROVED') {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: 'Đề tài chưa được duyệt!',
        };
      }

      if (topic.createdBy !== mentorId) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: 'Bạn không phải là người tạo đề tài này!',
        };
      }

      // **Lấy danh sách đăng ký với thông tin đề tài**
      const registrations = await prisma.topicRegistration.findMany({
        where: { topicId },
        include: {
          topic: {
            select: {
              topicCode: true,
              nameVi: true,
              nameEn: true,
              description: true,
            },
          },
        },
      });

      if (!registrations.length) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: 'Không có đăng ký nào cho đề tài này!',
        };
      }

      // **Lấy danh sách userId từ registrations**
      const userIds = registrations.map((reg) => reg.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true, email: true },
      });

      // **Tạo map để tra cứu thông tin người dùng nhanh chóng**
      const userMap = new Map(users.map((user) => [user.id, user]));

      // **Lấy vai trò "leader" từ bảng Role**
      const leaderRole = await prisma.role.findUnique({
        where: { name: "leader" },
      });

      if (!leaderRole) {
        return {
          success: false,
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          message: 'Vai trò leader không tồn tại!',
        };
      }

      // **Lấy thông tin nhóm của từng leader**
      const groupDetails = await Promise.all(
        userIds.map(async (userId) => {
          const groupMember = await prisma.groupMember.findFirst({
            where: {
              userId,
              roleId: leaderRole.id,
            },
            include: {
              group: {
                select: {
                  id: true,
                  groupCode: true,
                },
              },
            },
          });

          return {
            userId,
            groupId: groupMember?.group?.id || null,
            groupCode: groupMember?.group?.groupCode || null,
          };
        })
      );

      // **Tạo map để tra cứu thông tin nhóm nhanh chóng**
      const groupMap = new Map(groupDetails.map((detail) => [detail.userId, detail]));

      // **Định dạng dữ liệu trả về**
      const result = registrations.map((reg) => {
        const user = userMap.get(reg.userId);
        const group = groupMap.get(reg.userId);
        return {
          registrationId: reg.id,
          topicId: reg.topicId,
          topicCode: reg.topic.topicCode,
          nameVi: reg.topic.nameVi,
          nameEn: reg.topic.nameEn,
          description: reg.topic.description,
          registrationStatus: reg.status,
          registeredAt: reg.registeredAt,
          userId: reg.userId,
          userFullName: user?.fullName || '', // Tên leader
          userEmail: user?.email || '',       // Email leader
          groupId: group?.groupId || '',      // ID nhóm
          groupCode: group?.groupCode || '',  // Mã nhóm
          leaderRole: "leader",               // Vai trò leader
        };
      });

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: 'Lấy danh sách đăng ký đề tài thành công!',
        data: result,
      };
    } catch (error) {
      console.error('Lỗi khi lấy danh sách đăng ký đề tài:', error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống!',
      };
    }
  }

  async getAllRegistrations() {
    try {
      // Step 1: Fetch all registrations without including 'user'
      const registrations = await prisma.topicRegistration.findMany({
        include: {
          topic: true, // Include topic information if needed
        },
      });

      // Step 2: Extract userIds from registrations
      const userIds = registrations.map((reg) => reg.userId);

      // Step 3: Fetch user data based on userIds
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true, email: true },
      });

      // Step 4: Create a map for quick user lookup
      const userMap = new Map(users.map((user) => [user.id, user]));

      // Step 5: Combine registration data with user info
      const result = registrations.map((reg) => ({
        ...reg,
        user: userMap.get(reg.userId) || null,
      }));

      return {
        success: true,
        status: 200,
        message: 'Lấy danh sách đăng ký thành công!',
        data: result,
      };
    } catch (error) {
      console.error('Lỗi khi lấy danh sách đăng ký:', error);
      return {
        success: false,
        status: 500,
        message: 'Lỗi hệ thống!',
      };
    }
  }

  async getGroupRegistrations(groupId: string, userId: string, semesterId: string) {
    try {
      // Kiểm tra xem user có thuộc nhóm không
      const isMember = await prisma.groupMember.findFirst({
        where: { groupId, userId },
      });
      if (!isMember) {
        return {
          success: false,
          status: 403,
          message: 'Bạn không phải là thành viên của nhóm này!',
        };
      }

      // Lấy thông tin của leader, bao gồm tên và email
      const leader = await prisma.groupMember.findFirst({
        where: { groupId, role: { name: 'leader' } },
        select: {
          userId: true,
          user: {
            select: { fullName: true, email: true },
          },
        },
      });
      if (!leader || !leader.userId) {
        return {
          success: false,
          status: 404,
          message: 'Không tìm thấy leader của nhóm!',
        };
      }

      // Lấy tất cả các đăng ký của leader cho học kỳ cụ thể
      const registrations = await prisma.topicRegistration.findMany({
        where: {
          userId: leader.userId,
          topic: { semesterId: semesterId },
        },
        include: {
          topic: true,
          // Giả sử có quan hệ với mentor, ví dụ trường reviewerId, và bạn có thể include thông tin mentor:
          // mentor: { select: { fullName: true, email: true } },
        },
      });

      if (!registrations || registrations.length === 0) {
        return {
          success: false,
          status: 404,
          message: 'Nhóm chưa đăng ký đề tài nào!',
        };
      }

      // Nếu muốn format kết quả để chỉ hiển thị thông tin cần thiết
      const formattedResult = {
        leader: {
          email: leader.user ? leader.user.email : null,
        },
        registrations: registrations.map((reg) => ({
           
          status: reg.status,
          rejectionReason: reg.rejectionReason,
          registeredAt: reg.registeredAt,
          reviewedAt: reg.reviewedAt,
          // Nếu muốn include thêm thông tin của đề tài, bạn có thể expand thêm:
          topic: reg.topic,
        })),
      };

      return {
        success: true,
        status: 200,
        message: 'Lấy thông tin đăng ký của nhóm thành công!',
        data: formattedResult,
      };
    } catch (error) {
      console.error('Lỗi khi lấy thông tin đăng ký của nhóm:', error);
      return {
        success: false,
        status: 500,
        message: 'Lỗi hệ thống!',
      };
    }
  }


}