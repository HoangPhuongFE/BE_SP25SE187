import { Prisma, PrismaClient } from '@prisma/client';
import { TOPIC_MESSAGE, GROUP_MESSAGE } from '../constants/message';
import HTTP_STATUS from '../constants/httpStatus';
import { SystemConfigService } from './system.config.service';


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
      // **Kiểm tra dữ liệu đầu vào bắt buộc**
      if (!data.semesterId || !data.createdBy) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: !data.semesterId ? 'Thiếu `semesterId`!' : 'Thiếu `createdBy`!',
        };
      }

      // **Kiểm tra học kỳ**
      const semester = await prisma.semester.findUnique({
        where: { 
            id: data.semesterId,
            isDeleted: false 
        },
        select: { id: true, status: true, startDate: true, code: true },
      });
      if (!semester || !semester.code) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: 'Học kỳ không tồn tại hoặc thiếu mã học kỳ!',
        };
      }

      // **Kiểm tra vai trò của người tạo**
      let userRole = await prisma.userRole.findFirst({
        where: {
          userId: data.createdBy,
          isActive: true,
          OR: [
            { semesterId: data.semesterId }, // Vai trò gắn với học kỳ cụ thể
            { role: { isSystemWide: true } }, // Lọc qua quan hệ role         
          ],
        },
        include: { role: true }, // Ensure the 'role' relation is included
      });

      if (!userRole) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: 'Bạn không có quyền tạo đề tài!',
        };
      }

      const roleName = userRole.role.name.toUpperCase();
      const semesterStatus = semester.status.toUpperCase();

      // Kiểm tra nếu không phải Lecturer hoặc Academic Officer
      if (!['LECTURER', 'ACADEMIC_OFFICER'].includes(roleName)) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: 'Chỉ Academic Officer hoặc Lecturer mới được tạo đề tài!',
        };
      }

      // Kiểm tra giới hạn Lecturer chỉ tạo trong UPCOMING
      if (roleName === 'LECTURER' && semesterStatus !== 'UPCOMING') {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: 'Giảng viên chỉ được tạo đề tài trong học kỳ sắp tới (UPCOMING)!',
        };
      }



      // **Kiểm tra chuyên ngành**
      const major = await prisma.major.findUnique({ where: { id: data.majorId } });
      if (!major) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: 'Chuyên ngành không hợp lệ!',
        };
      }

      // **Tạo topicCode**
      const semesterCode = semester.code.toUpperCase();
      const majorCode =
        major.name.length > 1
          ? major.name.split(' ').map(word => word[0].toUpperCase()).join('')
          : major.name.slice(0, 2).toUpperCase();
      const topicCount = await prisma.topic.count({ where: { semesterId: data.semesterId } });
      const topicCode = `${majorCode}-${semesterCode}-${(topicCount + 1).toString().padStart(3, '0')}`;

      // **Xử lý đợt xét duyệt**
      const submissionPeriod = await prisma.submissionPeriod.findFirst({
        where: {
          semesterId: data.semesterId,
          OR: [{ status: 'ACTIVE' }, { endDate: { gte: new Date() } }],
        },
        orderBy: { startDate: 'asc' },
        select: { id: true, status: true },
      });
      if (!submissionPeriod) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: 'Không tìm thấy đợt xét duyệt phù hợp!',
        };
      }

      // **Xử lý subSupervisor**
      let subSupervisorId = data.subSupervisor;
      if (!subSupervisorId && data.subSupervisorEmail) {
        const mentor = await prisma.user.findUnique({
          where: { email: data.subSupervisorEmail },
          select: { id: true },
        });
        if (!mentor) {
          return {
            success: false,
            status: HTTP_STATUS.NOT_FOUND,
            message: 'Người đánh giá không hợp lệ!',
          };
        }
        subSupervisorId = mentor.id;
      }

      // **Xử lý isBusiness**
      const isBusiness =
        data.isBusiness !== undefined
          ? data.isBusiness === 'true' || data.isBusiness === true
          : true;

      // **Xử lý nhóm đề xuất**
      let groupIdToUse: string | undefined = data.groupId;
      if (!groupIdToUse && data.groupCode) {
        const group = await prisma.group.findUnique({
          where: { semesterId_groupCode: { semesterId: data.semesterId, groupCode: data.groupCode } },
          select: { id: true, groupCode: true },
        });
        if (!group) {
          return {
            success: false,
            status: HTTP_STATUS.NOT_FOUND,
            message: 'Nhóm không tồn tại!',
          };
        }
        groupIdToUse = group.id;
      } else if (groupIdToUse) {
        const group = await prisma.group.findUnique({
          where: { id: groupIdToUse },
          select: { id: true, groupCode: true },
        });
        if (!group) {
          return {
            success: false,
            status: HTTP_STATUS.NOT_FOUND,
            message: 'Nhóm không tồn tại!',
          };
        }
      }

      // **Kiểm tra nhóm đề xuất (nếu có)**
      if (groupIdToUse) {
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

        // Kiểm tra xem nhóm đã có đề tài được duyệt chưa
        const approvedTopicForGroup = await prisma.topic.findFirst({
          where: { proposedGroupId: groupIdToUse, status: 'APPROVED' },
        });
        if (approvedTopicForGroup) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: 'Nhóm này đã có đề tài được duyệt.',
          };
        }

        // Kiểm tra xem nhóm đã được gán cho đề tài nào khác chưa (qua TopicAssignment)
        const existingAssignment = await prisma.topicAssignment.findFirst({
          where: { groupId: groupIdToUse },
          include: {
            topic: {
              select: { topicCode: true, nameVi: true },
            },
          },
        });
        if (existingAssignment) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: `Nhóm này đã được gán cho đề tài khác: "${existingAssignment.topic.nameVi}" (Mã: ${existingAssignment.topic.topicCode}).`,
          };
        }

        // Kiểm tra xem nhóm đã có mentor chính nào khác gán chưa (qua GroupMentor)
        const mentorRoleForMain = await prisma.role.findUnique({ where: { name: "mentor_main" } });
        if (!mentorRoleForMain) throw new Error("Vai trò mentor_main không tồn tại.");

        const existingMentor = await prisma.groupMentor.findFirst({
          where: {
            groupId: groupIdToUse,
            roleId: mentorRoleForMain.id,
            mentorId: { not: data.createdBy }, // Không tính mentor hiện tại (createdBy)
          },
          include: {
            mentor: { select: { fullName: true } },
          },
        });
        if (existingMentor) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: `Nhóm này đã được gán cho mentor chính khác: ${existingMentor.mentor.fullName}.`,
          };
        }

        // Kiểm tra giới hạn số nhóm của mentor
        const mentorGroupCount = await prisma.groupMentor.count({
          where: { mentorId: data.createdBy, roleId: mentorRoleForMain.id },
        });
        if (mentorGroupCount >= 4) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: 'Mentor đã đạt số lượng nhóm tối đa (4 nhóm).',
          };
        }
      }

      // **Tạo đề tài với kết nối đến Major**
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
          mainSupervisor: data.createdBy,
          createdBy: data.createdBy,
          status: 'PENDING',
          name: data.name,
          proposedGroupId: groupIdToUse,
          majors: { connect: { id: data.majorId } },
        },
        include: { majors: true },
      });

      // **Tạo file nháp nếu có**
      let draftDocument;
      if (data.draftFileUrl) {
        draftDocument = await prisma.document.create({
          data: {
            fileName: 'Draft File',
            fileUrl: data.draftFileUrl,
            fileType: '',
            uploadedBy: data.createdBy,
            topicId: newTopic.id,
            documentType: 'draft',
          },
        });
      }

      // **Tạo GroupMentor nếu có nhóm đề xuất**
      if (groupIdToUse) {
        const mentorRole = await prisma.role.findUnique({ where: { name: "mentor_main" } });
        if (!mentorRole) throw new Error("Vai trò mentor không tồn tại.");

        const existingGroupMentor = await prisma.groupMentor.findUnique({
          where: { groupId_mentorId: { groupId: groupIdToUse, mentorId: data.createdBy } },
        });
        if (!existingGroupMentor) {
          await prisma.groupMentor.create({
            data: {
              groupId: groupIdToUse,
              mentorId: data.createdBy,
              roleId: mentorRole.id,
              addedBy: data.createdBy,
            },
          });
        }
      }

      // **Trả về kết quả thành công**
      return {
        success: true,
        status: HTTP_STATUS.CREATED,
        message: 'Đề tài đã được tạo thành công!',
        data: {
          topic: { ...newTopic, draftFileUrl: draftDocument?.fileUrl },
          group: groupIdToUse
            ? await prisma.group.findUnique({
              where: { id: groupIdToUse },
              select: { id: true, groupCode: true },
            })
            : null,
        },
      };
    } catch (error) {
      console.error('Lỗi khi tạo đề tài:', error);
      const isDev = process.env.NODE_ENV !== 'production';
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: isDev
          ? `Lỗi hệ thống khi tạo đề tài: ${(error as Error).message}`
          : 'Lỗi hệ thống khi tạo đề tài.',
      };
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

      // Lấy thông tin đề tài với majorId
      let topic;
      if (topicId) {
        topic = await prisma.topic.findUnique({
          where: { id: topicId },
          select: {
            id: true,
            status: true,
            topicAssignments: true,
            submissionPeriodId: true,
            topicCode: true,
            proposedGroupId: true,
            majors: { select: { id: true } }, // Lấy majorId của đề tài
          },
        });
      } else if (topicCode) {
        topic = await prisma.topic.findUnique({
          where: { topicCode },
          select: {
            id: true,
            status: true,
            topicAssignments: true,
            submissionPeriodId: true,
            topicCode: true,
            proposedGroupId: true,
            majors: { select: { id: true } }, // Lấy majorId của đề tài
          },
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

      // Kiểm tra chuyên ngành của leader
      const leaderStudent = await prisma.student.findUnique({
        where: { userId: leaderId },
        select: { majorId: true },
      });
      if (!leaderStudent || !leaderStudent.majorId) {
        return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: 'Không tìm thấy thông tin chuyên ngành của bạn.' };
      }

      // Lấy majorId của đề tài (giả sử đề tài chỉ liên kết với một chuyên ngành)
      const topicMajorId = topic.majors[0]?.id;
      if (!topicMajorId) {
        return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Đề tài không có thông tin chuyên ngành!' };
      }

      // So sánh majorId của leader và đề tài
      if (topicMajorId !== leaderStudent.majorId) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: 'Đề tài không cùng chuyên ngành với nhóm của bạn!',
        };
      }

      // Kiểm tra đăng ký hiện có
      const existingRegistration = await prisma.topicRegistration.findFirst({
        where: { topicId: topic.id, userId: leaderId },
      });
      if (existingRegistration) {
        return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: 'Nhóm của bạn đã đăng ký đề tài này!' };
      }

      // Tạo đăng ký mới
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
      semesterId?: string;
      documents?: { fileName: string; fileUrl: string; fileType: string }[];
    }
  ) {
    try {
      // Kiểm tra đề tài tồn tại
      const existingTopic = await prisma.topic.findUnique({
        where: { id: topicId },
        include: {
          creator: true,
          group: {
            include: {
              members: {
                include: {
                  student: true,
                  user: true
                }
              }
            }
          }
        }
      });

      if (!existingTopic) {
        return {
          success: false,
          message: TOPIC_MESSAGE.TOPIC_NOT_FOUND,
          status: HTTP_STATUS.NOT_FOUND,
        };
      }

      // Nếu có groupId hoặc groupCode, tìm thông tin nhóm
      let group = null;
      if (data.groupId || data.groupCode) {
        group = await prisma.group.findFirst({
          where: {
            OR: [
              { id: data.groupId },
              { groupCode: data.groupCode }
            ],
            semesterId: data.semesterId || existingTopic.semesterId
          },
          include: {
            members: {
              include: {
                student: true,
                user: true
              }
            }
          }
        });

        if (!group) {
          return {
            success: false,
            message: 'Không tìm thấy nhóm với thông tin đã cung cấp',
            status: HTTP_STATUS.NOT_FOUND
          };
        }
      }

      // Cập nhật đề tài
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
          subSupervisor: data.subSupervisor,
          proposedGroupId: group?.id || undefined,
          updatedAt: new Date(),
          documents: data.documents ? {
            createMany: {
              data: data.documents.map(doc => ({
                ...doc,
                uploadedBy: data.updatedBy
              }))
            }
          } : undefined
        },
        include: {
          creator: true,
          group: true,
          documents: true
        }
      });

      return {
        success: true,
        message: TOPIC_MESSAGE.TOPIC_UPDATED,
        data: updatedTopic,
        status: HTTP_STATUS.OK,
      };
    } catch (error) {
      console.error('Lỗi khi cập nhật đề tài:', error);
      return {
        success: false,
        message: TOPIC_MESSAGE.ACTION_FAILED,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      };
    }
  }


  async getTopicsBySemester(semesterId: string, round?: number) {
    try {
      const semester = await prisma.semester.findUnique({
        where: { 
            id: semesterId,
            isDeleted: false 
        },
        select: { id: true },
      });
      if (!semester) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: 'Học kỳ không tồn tại.',
        };
      }

      let whereClause: any = { semesterId };
      if (round !== undefined) {
        const submissionPeriod = await prisma.submissionPeriod.findFirst({
          where: { semesterId, roundNumber: round },
          select: { id: true },
        });
        if (!submissionPeriod) {
          return {
            success: false,
            status: HTTP_STATUS.NOT_FOUND,
            message: `Không tìm thấy đợt xét duyệt ${round} trong học kỳ này.`,
          };
        }
        whereClause.submissionPeriodId = submissionPeriod.id;
      }

      const topics = await prisma.topic.findMany({
        where: whereClause,
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
          group: { select: { id: true, groupCode: true } }, // Nhóm đề xuất
          topicAssignments: { // Nhóm thực tế
            select: {
              group: { select: { id: true, groupCode: true } },
            },
            take: 1, // Lấy assignment đầu tiên
          },
          majors: { // Thêm để lấy majorId và majorCode
            select: {
              id: true,    // majorId
              name: true,  // majorCode
            },
          },
        },
      });

      // Định dạng dữ liệu để hiển thị nhóm hợp lý
      const formattedTopics = topics.map(topic => ({
        ...topic,
        group: topic.topicAssignments.length > 0
          ? topic.topicAssignments[0].group 
          : topic.group, 
        topicAssignments: undefined, 
        majors: topic.majors, 
      }));

      if (formattedTopics.length === 0) {
        return {
          success: true,
          status: HTTP_STATUS.OK,
          message: round !== undefined
            ? `Không có đề tài nào trong đợt xét duyệt ${round} của học kỳ này.`
            : 'Không có đề tài nào trong học kỳ này.',
          data: [],
        };
      }

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: round !== undefined
          ? `Lấy danh sách đề tài trong đợt xét duyệt ${round} thành công.`
          : 'Lấy danh sách đề tài trong học kỳ thành công.',
        data: formattedTopics,
      };
    } catch (error) {
      console.error('Lỗi khi lấy danh sách đề tài:', error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi khi lấy danh sách đề tài.',
      };
    }
  }
  async getTopicById(topicId: string) {
    try {
      const topic = await prisma.topic.findUnique({
        where: { id: topicId },
        include: {
          creator: { select: { fullName: true, email: true } },
          subMentor: { select: { fullName: true, email: true } },
          majors: { select: { id: true, name: true } },
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
      if (!['APPROVED', 'REJECTED', 'IMPROVED'].includes(status)) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: 'Trạng thái không hợp lệ! Chỉ chấp nhận APPROVED, REJECTED hoặc IMPROVED.',
        };
      }

      const topic = await prisma.topic.findUnique({
        where: { id: topicId },
        include: {
          group: {
            select: {
              id: true,
              groupCode: true,
              semesterId: true,
              mentors: { select: { mentorId: true, roleId: true } },
            },
          },
        },
      });

      if (!topic) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: 'Đề tài không tồn tại!',
        };
      }

      if (topic.status !== 'PENDING') {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: 'Đề tài không ở trạng thái PENDING nên không thể duyệt!',
        };
      }

      // Cập nhật trạng thái đề tài (không reset proposedGroupId)
      const updatedTopic = await prisma.topic.update({
        where: { id: topicId },
        data: {
          status,
          reviewReason: reviewReason || null,
          updatedAt: new Date(),
        },
        include: { group: true },
      });

      // Xử lý khi APPROVED
      if (status === 'APPROVED' && topic.proposedGroupId) {
        const existingAssignment = await prisma.topicAssignment.findFirst({
          where: { topicId, groupId: topic.proposedGroupId },
        });

        if (!existingAssignment) {
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
        }

        const mentorMainRole = await prisma.role.findUnique({ where: { name: "mentor_main" } });
        if (!mentorMainRole) throw new Error("Vai trò mentor_main không tồn tại.");

        const creator = await prisma.user.findUnique({
          where: { id: topic.createdBy },
          select: { roles: { select: { role: true } } },
        });
        const isLecturer = creator?.roles.some(r => r.role.name.toLowerCase() === 'lecturer');

        const hasMentorMain = topic.group?.mentors.some(gm => gm.roleId === mentorMainRole.id) || false;
        if (isLecturer && !hasMentorMain) {
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
        }

        if (topic.subSupervisor) {
          const mentorSubRole = await prisma.role.findUnique({ where: { name: "mentor_sub" } });
          if (!mentorSubRole) throw new Error("Vai trò mentor_sub không tồn tại.");
          const hasMentorSub = topic.group?.mentors.some(gm => gm.mentorId === topic.subSupervisor) || false;
          if (!hasMentorSub) {
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

        // KHÔNG reset proposedGroupId
      }

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: status === 'APPROVED' ? 'Đề tài đã được duyệt thành công!' : status === 'REJECTED' ? 'Đề tài đã bị từ chối.' : 'Đề tài cần được cải thiện thêm.',
        data: { topic: updatedTopic, group: updatedTopic.group },
      };
    } catch (error) {
      console.error('Lỗi khi duyệt đề tài:', error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống khi duyệt đề tài!',
      };
    }
  }

  async approveTopicRegistrationByMentor(
    registrationId: string,
    data: { status: 'APPROVED' | 'REJECTED'; reason?: string },
    userId: string
  ) {
    try {
      // Kiểm tra dữ liệu đầu vào
      if (!registrationId || !userId) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: 'Vui lòng cung cấp registrationId và userId hợp lệ!',
        };
      }

      if (!['APPROVED', 'REJECTED'].includes(data.status)) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: 'Trạng thái không hợp lệ! Chỉ chấp nhận APPROVED hoặc REJECTED.',
        };
      }

      // Lấy thông tin đăng ký
      const registration = await prisma.topicRegistration.findUnique({
        where: { id: registrationId },
        include: {
          topic: {
            select: {
              id: true,
              topicCode: true,
              nameVi: true,
              createdBy: true,
              status: true,
              submissionPeriodId: true,
            },
          },
        },
      });

      if (!registration) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: 'Không tìm thấy đăng ký đề tài!',
        };
      }

      // Kiểm tra quyền hạn và trạng thái
      if (registration.topic.createdBy !== userId) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: 'Chỉ mentor tạo đề tài mới có quyền duyệt đăng ký!',
        };
      }

      if (registration.topic.status !== 'APPROVED') {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: 'Đề tài chưa được duyệt bởi Academic Officer!',
        };
      }

      if (registration.status !== 'PENDING') {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: 'Đăng ký này không ở trạng thái PENDING!',
        };
      }

      // Kiểm tra thời gian nộp đăng ký
      const submissionPeriod = await prisma.submissionPeriod.findUnique({
        where: { id: registration.topic.submissionPeriodId || '' },
        select: { startDate: true, endDate: true },
      });

      if (!submissionPeriod) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: 'Không tìm thấy thời gian nộp đăng ký!',
        };
      }

      const currentDate = new Date();
      const startDate = new Date(submissionPeriod.startDate);
      const endDate = new Date(submissionPeriod.endDate);

      if (currentDate < startDate || currentDate > endDate) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: 'Thời gian nộp đăng ký đã hết hoặc chưa bắt đầu!',
        };
      }

      // Kiểm tra xem đề tài đã được gán cho nhóm nào khác chưa
      const existingApproved = await prisma.topicRegistration.findFirst({
        where: { topicId: registration.topic.id, status: "APPROVED" },
      });
      if (existingApproved) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: 'Đề tài đã được gán cho một nhóm khác!',
        };
      }

      // Sử dụng transaction để đảm bảo tính nhất quán
      const result = await prisma.$transaction(async (tx) => {
        // Cập nhật trạng thái đăng ký
        const updatedRegistration = await tx.topicRegistration.update({
          where: { id: registrationId },
          data: {
            status: data.status,
            reason: data.reason || null,
            reviewedAt: new Date(),
            reviewerId: userId,
          },
        });

        // Tạo thông báo cho người đăng ký
        const notificationMessage =
          data.status === 'APPROVED'
            ? `Chúc mừng! Đăng ký đề tài "${registration.topic.nameVi}" của bạn đã được duyệt! ${data.reason ? `Lý do: ${data.reason}` : ''}`
            : `Rất tiếc, đăng ký đề tài "${registration.topic.nameVi}" của bạn chưa được duyệt. Lý do: ${data.reason || 'Không có lý do cụ thể'}.`;

        const notification = await tx.notification.create({
          data: {
            title: data.status === 'APPROVED' ? 'Đăng ký đề tài được duyệt' : 'Đăng ký đề tài chưa được duyệt',
            content: notificationMessage,
            notificationType: 'TOPIC_REGISTRATION',
            createdBy: userId,
            isSystem: false,
            createdAt: new Date(),
          },
        });

        await tx.notificationRecipient.create({
          data: {
            notificationId: notification.id,
            userId: registration.userId,
            isRead: false,
            readAt: null,
          },
        });

        if (data.status === 'REJECTED') {
          return {
            success: true,
            status: HTTP_STATUS.OK,
            message: 'Đã từ chối đăng ký đề tài!',
            data: {
              registration: updatedRegistration,
              reason: updatedRegistration.reason,
            },
          };
        }

        // Xử lý khi APPROVED
        const student = await tx.student.findFirst({
          where: { userId: registration.userId },
          select: { id: true },
        });

        if (!student) {
          return {
            success: false,
            status: HTTP_STATUS.NOT_FOUND,
            message: 'Không tìm thấy sinh viên!',
          };
        }

        const leaderRole = await tx.role.findUnique({ where: { name: "leader" } });
        if (!leaderRole) throw new Error("Vai trò 'leader' không tồn tại.");

        const leaderGroup = await tx.groupMember.findFirst({
          where: {
            studentId: student.id,
            roleId: leaderRole.id,
          },
          select: { groupId: true },
        });

        if (!leaderGroup) {
          return {
            success: false,
            status: HTTP_STATUS.NOT_FOUND,
            message: 'Không tìm thấy nhóm của leader!',
          };
        }

        // Kiểm tra số lượng thành viên trong nhóm
        const groupMembers = await tx.groupMember.count({
          where: { groupId: leaderGroup.groupId, isActive: true },
        });

        const MIN_GROUP_SIZE = 3;
        if (groupMembers < MIN_GROUP_SIZE) {
          const autoRejectReason = 'Nhóm không đủ năng lực: Số lượng thành viên không đủ (ít nhất 3 thành viên).';
          const autoRejectedRegistration = await tx.topicRegistration.update({
            where: { id: registrationId },
            data: {
              status: 'REJECTED',
              reason: autoRejectReason,
              reviewedAt: new Date(),
              reviewerId: userId,
            },
          });

          const autoRejectNotification = await tx.notification.create({
            data: {
              title: 'Đăng ký đề tài chưa được duyệt',
              content: `Rất tiếc, đăng ký đề tài "${registration.topic.nameVi}" của bạn chưa được duyệt tự động. Lý do: ${autoRejectReason}`,
              notificationType: 'TOPIC_REGISTRATION',
              createdBy: userId,
              isSystem: true,
              createdAt: new Date(),
            },
          });

          await tx.notificationRecipient.create({
            data: {
              notificationId: autoRejectNotification.id,
              userId: registration.userId,
              isRead: false,
              readAt: null,
            },
          });

          return {
            success: false,
            status: HTTP_STATUS.FORBIDDEN,
            message: autoRejectReason,
            data: {
              registration: autoRejectedRegistration,
              reason: autoRejectReason,
            },
          };
        }

        const MAX_GROUP_SIZE = 5;
        if (groupMembers > MAX_GROUP_SIZE) {
          return {
            success: false,
            status: HTTP_STATUS.FORBIDDEN,
            message: `Nhóm đã vượt quá số lượng thành viên tối đa (${MAX_GROUP_SIZE})!`,
          };
        }

        // Kiểm tra xem nhóm đã được gán cho đề tài nào khác chưa
        const existingGroupAssignment = await tx.topicAssignment.findFirst({
          where: {
            groupId: leaderGroup.groupId,
            approvalStatus: 'APPROVED',
          },
          include: {
            topic: {
              select: {
                topicCode: true,
                nameVi: true,
              },
            },
          },
        });

        if (existingGroupAssignment) {
          return {
            success: false,
            status: HTTP_STATUS.FORBIDDEN,
            message: `Nhóm này đã được duyệt cho đề tài khác: "${existingGroupAssignment.topic.nameVi}" (Mã: ${existingGroupAssignment.topic.topicCode})!`,
          };
        }

        // Kiểm tra và tạo TopicAssignment
        const existingAssignment = await tx.topicAssignment.findFirst({
          where: { topicId: registration.topic.id },
        });

        let groupInfo = null;
        if (!existingAssignment) {
          await tx.topicAssignment.create({
            data: {
              topicId: registration.topic.id,
              groupId: leaderGroup.groupId,
              assignedBy: userId,
              approvalStatus: 'APPROVED',
              defendStatus: 'NOT_SCHEDULED',
              status: 'ASSIGNED',
            },
          });

          const mentorRole = await tx.role.findUnique({ where: { name: "mentor_main" } });
          if (!mentorRole) throw new Error("Vai trò mentor_main không tồn tại.");
          await tx.groupMentor.upsert({
            where: { groupId_mentorId: { groupId: leaderGroup.groupId, mentorId: userId } },
            update: {},
            create: {
              groupId: leaderGroup.groupId,
              mentorId: userId,
              roleId: mentorRole.id,
              addedBy: userId,
            },
          });

          groupInfo = await tx.group.findUnique({
            where: { id: leaderGroup.groupId },
            select: { id: true, groupCode: true },
          });
        }

        // Từ chối các đăng ký PENDING khác
        const pendingRegistrations = await tx.topicRegistration.findMany({
          where: {
            topicId: registration.topic.id,
            status: "PENDING",
          },
          select: { id: true, userId: true },
        });

        for (const pending of pendingRegistrations) {
          await tx.topicRegistration.update({
            where: { id: pending.id },
            data: {
              status: "REJECTED",
              reviewedAt: new Date(),
              reviewerId: userId,
              reason: 'Đề tài đã được gán cho nhóm khác.',
            },
          });

          const rejectNotification = await tx.notification.create({
            data: {
              title: 'Đăng ký đề tài chưa được duyệt',
              content: `Rất tiếc, đăng ký đề tài "${registration.topic.nameVi}" của bạn chưa được duyệt vì đề tài đã được gán cho một nhóm khác. Bạn có thể chọn một đề tài khác để tiếp tục hành trình của mình!`,
              notificationType: 'TOPIC_REGISTRATION',
              createdBy: userId,
              isSystem: false,
              createdAt: new Date(),
            },
          });

          await tx.notificationRecipient.create({
            data: {
              notificationId: rejectNotification.id,
              userId: pending.userId,
              isRead: false,
              readAt: null,
            },
          });
        }

        const userInfo = await tx.user.findUnique({
          where: { id: registration.userId },
          select: { fullName: true, email: true },
        });

        if (!userInfo) {
          return {
            success: false,
            status: HTTP_STATUS.NOT_FOUND,
            message: 'Không tìm thấy thông tin người đăng ký!',
          };
        }

        return {
          success: true,
          status: HTTP_STATUS.OK,
          message: 'Duyệt đăng ký đề tài thành công!',
          data: {
            registration: updatedRegistration,
            user: userInfo,
            group: groupInfo,
            reason: updatedRegistration.reason,
          },
        };
      });

      return result;
    } catch (error: any) {
      console.error('Lỗi khi duyệt đăng ký đề tài:', error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống khi duyệt đăng ký đề tài!',
      };
    }
  }
  async deleteTopic(topicId: string, isSystemWide: boolean, userId: string, ipAddress?: string) {
    try {
      // Tìm đề tài và các thông tin liên quan
      const topic = await prisma.topic.findUnique({
        where: { id: topicId, isDeleted: false }, // Chỉ tìm đề tài chưa bị xóa
        select: {
          status: true,
          createdBy: true,
          topicAssignments: true,
          topicRegistrations: true,
          proposedGroupId: true,
          name: true,
        },
      });
  
      if (!topic) {
        await prisma.systemLog.create({
          data: {
            userId,
            action: 'DELETE_TOPIC_ATTEMPT',
            entityType: 'Topic',
            entityId: topicId,
            description: 'Thử xóa đề tài nhưng không tìm thấy hoặc đã bị đánh dấu xóa',
            severity: 'WARNING',
            ipAddress: ipAddress || 'unknown',
          },
        });
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy đề tài!' };
      }
  
      // Kiểm tra vai trò của người dùng
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } },
      });
      if (!user) {
        await prisma.systemLog.create({
          data: {
            userId,
            action: 'DELETE_TOPIC_ATTEMPT',
            entityType: 'Topic',
            entityId: topicId,
            description: 'Thử xóa đề tài nhưng người dùng không tồn tại',
            severity: 'ERROR',
            ipAddress: ipAddress || 'unknown',
          },
        });
        return { success: false, status: HTTP_STATUS.FORBIDDEN, message: 'Người dùng không tồn tại!' };
      }
  
      const userRoles = user.roles.map(r => r.role.name.toLowerCase());
      const isAcademic = userRoles.includes('academic_officer');
  
      // Kiểm tra quyền xóa
      if (!isSystemWide && !isAcademic && topic.createdBy !== userId) {
        await prisma.systemLog.create({
          data: {
            userId,
            action: 'DELETE_TOPIC_ATTEMPT',
            entityType: 'Topic',
            entityId: topicId,
            description: 'Thử xóa đề tài nhưng không có quyền',
            severity: 'WARNING',
            ipAddress: ipAddress || 'unknown',
            metadata: { attemptedBy: userId, required: 'creator, academic, or system-wide' },
          },
        });
        return { success: false, status: HTTP_STATUS.FORBIDDEN, message: 'Chỉ người tạo, academic hoặc admin mới được phép xóa!' };
      }
  
      // Kiểm tra ràng buộc nếu không phải system-wide hoặc academic
      if (!isSystemWide && !isAcademic) {
        if (topic.status !== 'PENDING') {
          await prisma.systemLog.create({
            data: {
              userId,
              action: 'DELETE_TOPIC_ATTEMPT',
              entityType: 'Topic',
              entityId: topicId,
              description: 'Thử xóa đề tài nhưng trạng thái không phải PENDING',
              severity: 'WARNING',
              ipAddress: ipAddress || 'unknown',
              metadata: { currentStatus: topic.status },
            },
          });
          return { success: false, status: HTTP_STATUS.FORBIDDEN, message: 'Chỉ có thể xóa đề tài ở trạng thái PENDING!' };
        }
        if (topic.topicAssignments.length > 0 || topic.topicRegistrations.length > 0 || topic.proposedGroupId) {
          await prisma.systemLog.create({
            data: {
              userId,
              action: 'DELETE_TOPIC_ATTEMPT',
              entityType: 'Topic',
              entityId: topicId,
              description: 'Thử xóa đề tài nhưng đã có nhóm đăng ký hoặc đề xuất',
              severity: 'WARNING',
              ipAddress: ipAddress || 'unknown',
              metadata: {
                assignmentsCount: topic.topicAssignments.length,
                registrationsCount: topic.topicRegistrations.length,
                proposedGroupId: topic.proposedGroupId,
              },
            },
          });
          return { success: false, status: HTTP_STATUS.FORBIDDEN, message: 'Không thể xóa đề tài đã có nhóm đăng ký hoặc đề xuất!' };
        }
      }
  
      // Xóa mềm toàn bộ dữ liệu liên quan trong giao dịch
      const updatedTopic = await prisma.$transaction(async (tx) => {
        // 1. Đánh dấu xóa các ReviewSchedule liên quan
        await tx.reviewSchedule.updateMany({
          where: { topicId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 2. Đánh dấu xóa các ReviewAssignment liên quan
        await tx.reviewAssignment.updateMany({
          where: { topicId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 3. Đánh dấu xóa các Document liên quan
        await tx.document.updateMany({
          where: { topicId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 4. Đánh dấu xóa các SemesterTopicMajor liên quan
        await tx.semesterTopicMajor.updateMany({
          where: { topicId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 5. Đánh dấu xóa các DetailMajorTopic liên quan
        await tx.detailMajorTopic.updateMany({
          where: { topicId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 6. Đánh dấu xóa các TopicAssignment liên quan
        await tx.topicAssignment.updateMany({
          where: { topicId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 7. Đánh dấu xóa các TopicRegistration liên quan
        await tx.topicRegistration.updateMany({
          where: { topicId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 8. Đánh dấu xóa các AIVerificationLog liên quan
      
  
        // 9. Đánh dấu xóa Topic
        await tx.topic.update({
          where: { id: topicId },
          data: { isDeleted: true },
        });
  
        // 10. Ghi log hành động xóa thành công
        await tx.systemLog.create({
          data: {
            userId,
            action: 'DELETE_TOPIC',
            entityType: 'Topic',
            entityId: topicId,
            description: `Đề tài "${topic.name}" đã được đánh dấu xóa bởi ${isAcademic ? 'academic_officer' : isSystemWide ? 'admin' : 'người tạo'}`,
            severity: 'INFO',
            ipAddress: ipAddress || 'unknown',
            metadata: {
              deletedByRole: isAcademic ? 'academic_officer' : isSystemWide ? 'admin' : 'creator',
              topicName: topic.name,
              status: topic.status,
              assignmentsCount: topic.topicAssignments.length,
              registrationsCount: topic.topicRegistrations.length,
              proposedGroupId: topic.proposedGroupId,
            },
            oldValues: JSON.stringify(topic),
          },
        });
  
        // Trả về dữ liệu Topic sau khi cập nhật
        return await tx.topic.findUnique({
          where: { id: topicId },
          select: {
            status: true,
            createdBy: true,
            topicAssignments: true,
            topicRegistrations: true,
            proposedGroupId: true,
            name: true,
            isDeleted: true,
          },
        });
      });
  
      return { success: true, status: HTTP_STATUS.OK, message: 'Đề tài đã được đánh dấu xóa thành công!', data: updatedTopic };
    } catch (error) {
      await prisma.systemLog.create({
        data: {
          userId,
          action: 'DELETE_TOPIC_ERROR',
          entityType: 'Topic',
          entityId: topicId,
          description: 'Lỗi hệ thống khi đánh dấu xóa đề tài',
          severity: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
          stackTrace: (error as Error).stack || 'No stack trace',
          ipAddress: ipAddress || 'unknown',
        },
      });
      console.error('Lỗi khi đánh dấu xóa đề tài:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi hệ thống khi đánh dấu xóa đề tài!' };
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
        const semester = await prisma.semester.findUnique({ 
            where: { 
                id: query.semesterId,
                isDeleted: false 
            } 
        });
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
        where: { createdBy: mentorId },
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

  async getTopicRegistrations(topicId: string, mentorId: string) {
    try {
      // Kiểm tra đề tài
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

      // Lấy danh sách đăng ký với thông tin đề tài
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

      // Lấy danh sách userId từ registrations
      const userIds = registrations.map((reg) => reg.userId);

      // **Bước 1: Lấy studentId từ userId**
      const students = await prisma.student.findMany({
        where: { userId: { in: userIds } },
        select: { id: true, userId: true },
      });

      // Tạo map để tra cứu studentId từ userId
      const studentMap = new Map(students.map((student) => [student.userId, student.id]));

      // Lấy vai trò "leader" từ bảng Role
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

      // **Bước 2: Lấy thông tin nhóm từ studentId**
      const groupDetails = await Promise.all(
        userIds.map(async (userId) => {
          const studentId = studentMap.get(userId);
          if (!studentId) {
            return {
              userId,
              groupId: null,
              groupCode: null,
            };
          }

          const groupMember = await prisma.groupMember.findFirst({
            where: {
              studentId,
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

      // Tạo map để tra cứu thông tin nhóm từ userId
      const groupMap = new Map(groupDetails.map((detail) => [detail.userId, detail]));

      // Lấy thông tin người dùng
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true, email: true },
      });

      const userMap = new Map(users.map((user) => [user.id, user]));

      // Định dạng dữ liệu trả về
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
          userFullName: user?.fullName || '',
          userEmail: user?.email || '',
          groupId: group?.groupId || '',
          groupCode: group?.groupCode || '',
          leaderRole: "leader",
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

  // Lấy danh sách đề tài đã duyệt cho sinh viên
  async getApprovedTopicsForStudent(userId: string) {
    try {
      // 1. Kiểm tra sinh viên
      const student = await prisma.student.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!student) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Bạn không phải là sinh viên!",
        };
      }

      // Ngày hiện tại
      const currentDate = new Date();

      // 2. Lấy danh sách nhóm của sinh viên
      const groupMemberships = await prisma.groupMember.findMany({
        where: { studentId: student.id },
        include: {
          group: {
            select: {
              id: true,
              groupCode: true,
              semester: { select: { id: true, code: true, startDate: true, endDate: true } },
            },
          },
        },
      });

      if (groupMemberships.length === 0) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Bạn không thuộc nhóm nào!",
        };
      }

      // 3. Xác định trạng thái thực tế của học kỳ
      const semesters = groupMemberships.map(m => {
        const semester = m.group.semester;
        const startDate = new Date(semester.startDate);
        const endDate = new Date(semester.endDate || Infinity);

        let effectiveStatus = "COMPLETE";
        if (currentDate < startDate) effectiveStatus = "UPCOMING";
        else if (currentDate >= startDate && currentDate <= endDate) effectiveStatus = "ACTIVE";

        return { ...semester, effectiveStatus, groupId: m.groupId };
      });

      const groupIds = groupMemberships.map(m => m.groupId);

      // 4. Lấy danh sách đề tài liên quan đến các nhóm
      const topics = await prisma.topic.findMany({
        where: {
          topicAssignments: {
            some: {
              groupId: { in: groupIds },
              approvalStatus: { in: ["PENDING", "APPROVED", "REJECTED"] },
            },
          },
          semester: {
            isDeleted: false
          }
        },
        include: {
          topicAssignments: {
            include: {
              group: {
                select: {
                  id: true,
                  groupCode: true,
                  semester: { select: { id: true, code: true, startDate: true, endDate: true } },
                  members: {
                    include: {
                      user: { select: { id: true, fullName: true, email: true } },
                      role: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
          creator: { select: { fullName: true, email: true } },
          subMentor: { select: { fullName: true, email: true } },
          majors: { select: { id: true, name: true } },
          semester: { select: { id: true, code: true, startDate: true, endDate: true } },
        },
      });

      if (topics.length === 0) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Không tìm thấy đề tài nào liên quan đến nhóm của bạn!",
        };
      }

      // 5. Định dạng dữ liệu trả về, xử lý trường hợp semester undefined
      const formattedTopics = topics.map(topic => {
        const assignment = topic.topicAssignments[0]; // Lấy assignment đầu tiên liên quan đến nhóm
        const semester = semesters.find(s => s.id === assignment.group.semester.id);

        // Nếu không tìm thấy semester, sử dụng thông tin từ assignment.group.semester
        const semesterData = semester || {
          id: assignment.group.semester.id,
          code: assignment.group.semester.code,
          startDate: assignment.group.semester.startDate,
          endDate: assignment.group.semester.endDate,
          effectiveStatus: "UNKNOWN", // Trạng thái mặc định nếu không tính được
        };

        return {
          id: topic.id,
          topicCode: topic.topicCode,
          nameVi: topic.nameVi,
          nameEn: topic.nameEn,
          description: topic.description,
          status: topic.status,
          approvalStatus: assignment.approvalStatus,
          semester: {
            id: semesterData.id,
            code: semesterData.code,
            startDate: semesterData.startDate,
            endDate: semesterData.endDate,
            effectiveStatus: semesterData.effectiveStatus,
          },
          createdBy: topic.creator,
          subSupervisor: topic.subMentor,
          majors: topic.majors,
          group: {
            id: assignment.group.id,
            groupCode: assignment.group.groupCode,
            members: assignment.group.members,
          },
        };
      });

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: "Lấy danh sách đề tài liên quan đến nhóm thành công!",
        data: formattedTopics,
      };
    } catch (error) {
      console.error("Lỗi khi lấy danh sách đề tài cho sinh viên:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống khi lấy danh sách đề tài!",
      };
    }
  }

  async getAllApprovedTopicsForStudent(userId: string) {
    try {
      const student = await prisma.student.findUnique({
        where: { userId },
        select: { id: true, majorId: true },
      });
  
      if (!student) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Bạn không phải là sinh viên!",
        };
      }
  
      const currentDate = new Date();
  
      const topics = await prisma.topic.findMany({
        where: { 
            status: "APPROVED",
            semester: {
                isDeleted: false
            }
        },
        select: {
            id: true,
            topicCode: true,
            nameVi: true,
            nameEn: true,
            description: true,
            status: true,
            createdBy: true,
            subSupervisor: true,
            mainSupervisor: true,
            createdAt: true,
            updatedAt: true,
            semester: {
                select: { id: true, code: true, startDate: true, endDate: true },
            },
            topicAssignments: {
                select: {
                    group: {
                        select: {
                            id: true,
                            groupCode: true,
                            semester: { select: { id: true, code: true } },
                            members: {
                                select: {
                                    id: true,
                                    user: { select: { id: true, fullName: true, email: true } },
                                    role: { select: { name: true } },
                                    student: {
                                        select: {
                                            major: { select: { id: true, name: true } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            creator: { select: { fullName: true, email: true } },
            subMentor: { select: { fullName: true, email: true } },
            majors: { select: { id: true, name: true } },
        },
      });
  
      // If you need mainMentor data, fetch it separately
      const topicsWithMainMentor = await Promise.all(
        topics.map(async (topic) => {
          const mainMentor = topic.mainSupervisor
            ? await prisma.user.findUnique({
                where: { id: topic.mainSupervisor },
                select: { fullName: true, email: true },
              })
            : null;
          return { ...topic, mainMentor };
        })
      );
  
      // Rest of your logic (semester status, filtering, formatting) remains the same
      // Use topicsWithMainMentor instead of topics
      const semesters = [...new Map(topicsWithMainMentor.map(t => [t.semester.id, t.semester])).values()];
      const semesterStatus = semesters.map(s => {
        const startDate = new Date(s.startDate);
        const endDate = new Date(s.endDate || Infinity);
        let effectiveStatus = "COMPLETE";
        if (currentDate < startDate) effectiveStatus = "UPCOMING";
        else if (currentDate >= startDate && currentDate <= endDate) effectiveStatus = "ACTIVE";
        return { ...s, effectiveStatus };
      });
  
      const upcomingSemesters = semesterStatus.filter(s => s.effectiveStatus === "UPCOMING");
      if (upcomingSemesters.length === 0) {
        const hasActive = semesterStatus.some(s => s.effectiveStatus === "ACTIVE");
        const hasComplete = semesterStatus.some(s => s.effectiveStatus === "COMPLETE");
        if (hasActive) {
          return {
            success: true,
            status: HTTP_STATUS.OK,
            message: "Hiện tại học kỳ đang diễn ra, bạn hãy tập trung vào đề tài của nhóm mình nhé!",
            data: [],
          };
        } else if (hasComplete) {
          return {
            success: true,
            status: HTTP_STATUS.OK,
            message: "Học kỳ đã kết thúc, hãy chờ học kỳ mới để xem các đề tài sắp tới!",
            data: [],
          };
        } else {
          return {
            success: true,
            status: HTTP_STATUS.OK,
            message: "Hiện tại chưa có đề tài nào cho học kỳ sắp tới, hãy quay lại sau nhé!",
            data: [],
          };
        }
      }
  
      const selectedSemester = upcomingSemesters.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];
      const validTopics = topicsWithMainMentor.filter(t => t.semester.id === selectedSemester.id);
  
      if (validTopics.length === 0) {
        return {
          success: true,
          status: HTTP_STATUS.OK,
          message: "Chưa có đề tài nào được duyệt cho học kỳ sắp tới, hãy chờ thêm nhé!",
          data: [],
        };
      }
  
      const formattedTopics = validTopics.map(topic => ({
        id: topic.id,
        topicCode: topic.topicCode,
        nameVi: topic.nameVi,
        nameEn: topic.nameEn,
        description: topic.description,
        status: topic.status,
        semester: topic.semester,
        createdBy: topic.creator,
        mainSupervisor: topic.mainMentor, // Use the fetched mainMentor
        subSupervisor: topic.subMentor,
        majors: topic.majors,
        group: topic.topicAssignments[0]?.group
          ? {
              id: topic.topicAssignments[0].group.id,
              groupCode: topic.topicAssignments[0].group.groupCode,
              semester: topic.topicAssignments[0].group.semester,
              members: topic.topicAssignments[0].group.members.map(member => ({
                id: member.id,
                fullName: member.user?.fullName || 'Không có thông tin',
                email: member.user?.email || 'Không có thông tin',
                major: member.student?.major?.name || 'Không có thông tin',
                role: member.role.name,
              })),
            }
          : null,
      }));
  
      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: `Danh sách các đề tài đã duyệt cho học kỳ sắp tới (${selectedSemester.code}) đã sẵn sàng để bạn khám phá!`,
        data: formattedTopics,
      };
    } catch (error) {
      console.error("Lỗi khi lấy danh sách tất cả đề tài đã duyệt cho sinh viên:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống khi lấy danh sách đề tài đã duyệt!",
      };
    }
  }


  private systemConfigService = new SystemConfigService();

  // Hàm kiểm tra email đơn giản
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async createTopicWithMentors(data: {
    nameVi: string;
    nameEn: string;
    description: string;
    semesterId: string;
    majorId: string;
    isBusiness?: boolean | string;
    businessPartner?: string;
    source?: string;
    mainMentorId?: string; // Là email của mentor chính
    subMentorId?: string;  // Là email của mentor phụ
    createdBy: string;
    draftFileUrl?: string;
    groupId?: string;
    groupCode?: string;
  }) {
    try {
      // Kiểm tra dữ liệu đầu vào bắt buộc
      if (!data.semesterId || !data.createdBy) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: !data.semesterId ? 'Thiếu `semesterId`!' : 'Thiếu `createdBy`!',
        };
      }

      // Kiểm tra quyền người tạo
      const userRole = await prisma.userRole.findFirst({
        where: { userId: data.createdBy, isActive: true },
        include: { role: true },
      });
      if (!userRole || !['ACADEMIC_OFFICER', 'GRADUATION_THESIS_MANAGER'].includes(userRole.role.name.toUpperCase())) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: 'Chỉ Academic Officer hoặc Thesis Manager mới được phép tạo đề tài này!',
        };
      }

      // Kiểm tra học kỳ
      const semester = await prisma.semester.findUnique({
        where: { 
            id: data.semesterId,
            isDeleted: false 
        },
        select: { id: true, status: true, startDate: true, code: true },
      });
      if (!semester || !semester.code) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: 'Học kỳ không tồn tại hoặc thiếu mã học kỳ!',
        };
      }

      // Kiểm tra chuyên ngành
      const major = await prisma.major.findUnique({ where: { id: data.majorId } });
      if (!major) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: 'Chuyên ngành không hợp lệ!',
        };
      }

      // Tạo mã đề tài
      const semesterCode = semester.code.toUpperCase();
      const majorCode =
        major.name.length > 1
          ? major.name.split(' ').map(word => word[0].toUpperCase()).join('')
          : major.name.slice(0, 2).toUpperCase();
      const topicCount = await prisma.topic.count({ where: { semesterId: data.semesterId } });
      const topicCode = `${majorCode}-${semesterCode}-${(topicCount + 1).toString().padStart(3, '0')}`;

      // Kiểm tra đợt xét duyệt
      const submissionPeriod = await prisma.submissionPeriod.findFirst({
        where: {
          semesterId: data.semesterId,
          OR: [{ status: 'ACTIVE' }, { endDate: { gte: new Date() } }],
        },
        orderBy: { startDate: 'asc' },
        select: { id: true, status: true },
      });
      if (!submissionPeriod) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: 'Không tìm thấy đợt xét duyệt phù hợp!',
        };
      }

      // Lấy cấu hình số lượng nhóm tối đa
      const maxGroupsPerMentor = await this.systemConfigService.getMaxGroupsPerMentor();

      // Kiểm tra vai trò mentor_main
      const mentorMainRole = await prisma.role.findUnique({ where: { name: 'mentor_main' } });
      if (!mentorMainRole) {
        return {
          success: false,
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          message: "Vai trò 'mentor_main' không tồn tại!",
        };
      }

      // Kiểm tra mentor chính (mainMentorId) bằng email
      let mainMentorId = data.mainMentorId;
      let mainMentorInfo = null;
      if (mainMentorId) {
        if (!this.isValidEmail(mainMentorId)) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: 'mainMentorId không hợp lệ (phải là email)!',
          };
        }
        const mainMentor = await prisma.user.findUnique({
          where: { email: mainMentorId }, // Tìm bằng email thay vì id
          select: { id: true, fullName: true, email: true, roles: { select: { role: { select: { name: true } } } } },
        });
        if (!mainMentor || !mainMentor.roles.some(r => r.role.name.toLowerCase() === 'lecturer')) {
          return {
            success: false,
            status: HTTP_STATUS.NOT_FOUND,
            message: 'Mentor chính không tồn tại hoặc không phải giảng viên!',
          };
        }
        mainMentorInfo = mainMentor;

        const mainMentorGroupCount = await prisma.groupMentor.count({
          where: { mentorId: mainMentor.id, roleId: mentorMainRole.id }, // Dùng id thay vì email
        });
        if (mainMentorGroupCount >= maxGroupsPerMentor) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: `Mentor "${mainMentor.fullName}" đã đạt số lượng nhóm tối đa (${maxGroupsPerMentor} nhóm)!`,
          };
        }
        mainMentorId = mainMentor.id; // Chuyển sang dùng id trong các bước sau
      }

      // Kiểm tra vai trò mentor_sub
      const mentorSubRole = await prisma.role.findUnique({ where: { name: 'mentor_sub' } });
      if (!mentorSubRole) {
        return {
          success: false,
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          message: "Vai trò 'mentor_sub' không tồn tại!",
        };
      }

      // Kiểm tra mentor phụ (subMentorId) bằng email
      let subMentorId = data.subMentorId;
      let subMentorInfo = null;
      if (subMentorId) {
        if (!this.isValidEmail(subMentorId)) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: 'subMentorId không hợp lệ (phải là email)!',
          };
        }
        const subMentor = await prisma.user.findUnique({
          where: { email: subMentorId }, // Tìm bằng email thay vì id
          select: { id: true, fullName: true, email: true, roles: { select: { role: { select: { name: true } } } } },
        });
        if (!subMentor || !subMentor.roles.some(r => r.role.name.toLowerCase() === 'lecturer')) {
          return {
            success: false,
            status: HTTP_STATUS.NOT_FOUND,
            message: 'Mentor phụ không tồn tại hoặc không phải giảng viên!',
          };
        }
        subMentorInfo = subMentor;

        const subMentorGroupCount = await prisma.groupMentor.count({
          where: { mentorId: subMentor.id, roleId: mentorSubRole.id }, // Dùng id thay vì email
        });
        if (subMentorGroupCount >= maxGroupsPerMentor) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: `Mentor "${subMentor.fullName}" đã đạt số lượng nhóm tối đa (${maxGroupsPerMentor} nhóm)!`,
          };
        }
        subMentorId = subMentor.id; // Chuyển sang dùng id trong các bước sau
      }

      // Xử lý nhóm (giữ nguyên logic)
      let groupIdToUse: string | undefined = data.groupId;
      if (!groupIdToUse && data.groupCode) {
        const group = await prisma.group.findUnique({
          where: { semesterId_groupCode: { semesterId: data.semesterId, groupCode: data.groupCode } },
          select: { id: true, groupCode: true },
        });
        if (!group) {
          return {
            success: false,
            status: HTTP_STATUS.NOT_FOUND,
            message: 'Nhóm không tồn tại!',
          };
        }
        groupIdToUse = group.id;
      } else if (groupIdToUse) {
        const group = await prisma.group.findUnique({
          where: { id: groupIdToUse },
          select: { id: true, groupCode: true },
        });
        if (!group) {
          return {
            success: false,
            status: HTTP_STATUS.NOT_FOUND,
            message: 'Nhóm không tồn tại!',
          };
        }
      }

      if (groupIdToUse) {
        const leaderRole = await prisma.role.findUnique({ where: { name: 'leader' } });
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
            message: 'Không tìm thấy thông tin sinh viên của trưởng nhóm.',
          };
        }

        if (groupLeader.student.majorId !== data.majorId) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: 'Nhóm được chọn không cùng chuyên ngành với đề tài.',
          };
        }

        const approvedTopicForGroup = await prisma.topic.findFirst({
          where: { proposedGroupId: groupIdToUse, status: 'APPROVED' },
        });
        if (approvedTopicForGroup) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: 'Nhóm này đã có đề tài được duyệt.',
          };
        }
      }

      const isBusiness =
        data.isBusiness !== undefined
          ? data.isBusiness === 'true' || data.isBusiness === true
          : false;

      // Tạo đề tài với trạng thái APPROVED
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
          mainSupervisor: mainMentorId, // Lưu ID thay vì email
          subSupervisor: subMentorId,   // Lưu ID thay vì email
          status: 'APPROVED',
          name: data.nameVi,
          proposedGroupId: groupIdToUse,
          createdBy: data.createdBy,
          majors: { connect: { id: data.majorId } },
        },
        include: { majors: true },
      });

      let draftDocument;
      if (data.draftFileUrl) {
        draftDocument = await prisma.document.create({
          data: {
            fileName: 'Draft File',
            fileUrl: data.draftFileUrl,
            fileType: '',
            uploadedBy: data.createdBy,
            topicId: newTopic.id,
            documentType: 'draft',
          },
        });
      }

      // Gán mentor vào nhóm và tạo TopicAssignment nếu có nhóm hoặc mentor
      let assignment = null;
      if (groupIdToUse || mainMentorId || subMentorId) {
        if (groupIdToUse) {
          if (mainMentorId) {
            await prisma.groupMentor.upsert({
              where: { groupId_mentorId: { groupId: groupIdToUse, mentorId: mainMentorId } },
              update: {},
              create: {
                groupId: groupIdToUse,
                mentorId: mainMentorId,
                roleId: mentorMainRole.id,
                addedBy: data.createdBy,
              },
            });
          }

          if (subMentorId) {
            await prisma.groupMentor.upsert({
              where: { groupId_mentorId: { groupId: groupIdToUse, mentorId: subMentorId } },
              update: {},
              create: {
                groupId: groupIdToUse,
                mentorId: subMentorId,
                roleId: mentorSubRole.id,
                addedBy: data.createdBy,
              },
            });
          }

          // Tạo TopicAssignment nếu có nhóm
          assignment = await prisma.topicAssignment.create({
            data: {
              topicId: newTopic.id,
              groupId: groupIdToUse,
              assignedBy: data.createdBy,
              approvalStatus: 'APPROVED',
              defendStatus: 'NOT_SCHEDULED',
              status: 'ASSIGNED',
            },
          });
        }
      }

      return {
        success: true,
        status: HTTP_STATUS.CREATED,
        message: 'Đề tài đã được tạo và gán mentor thành công!',
        data: {
          topic: { ...newTopic, draftFileUrl: draftDocument?.fileUrl },
          group: groupIdToUse
            ? await prisma.group.findUnique({
              where: { id: groupIdToUse },
              select: { id: true, groupCode: true },
            })
            : null,
          mainMentor: mainMentorInfo ? { id: mainMentorInfo.id, fullName: mainMentorInfo.fullName, email: mainMentorInfo.email } : null,
          subMentor: subMentorInfo ? { id: subMentorInfo.id, fullName: subMentorInfo.fullName, email: subMentorInfo.email } : null,
          assignment: assignment ? { id: assignment.id, groupId: assignment.groupId } : null,
        },
      };
    } catch (error) {
      console.error('Lỗi khi tạo đề tài với mentor:', error);
      const isDev = process.env.NODE_ENV !== 'production';
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: isDev
          ? `Lỗi hệ thống khi tạo đề tài: ${(error as Error).message}`
          : 'Lỗi hệ thống khi tạo đề tài.',
      };
    }
  }




  async assignMentorsOrGroupToTopic(
    topicId: string,
    data: {
      mainMentorEmail?: string;
      subMentorEmail?: string;
      groupId?: string;
      groupCode?: string;
      semesterId?: string;
    },
    updatedBy: string 
  ) {
    try {
      // Kiểm tra đầu vào cơ bản
      if (!topicId) {
        return {
          success: false,
          status: 400,
          message: 'Thiếu `topicId`!',
        };
      }
      if (!updatedBy) {
        return {
          success: false,
          status: 400,
          message: 'Thiếu `updatedBy`!',
        };
      }
      // Kiểm tra quyền hạn của người dùng
      const userRole = await prisma.userRole.findFirst({
        where: { userId: updatedBy, isActive: true },
        include: { role: true },
      });
      if (!userRole || !['ACADEMIC_OFFICER', 'GRADUATION_THESIS_MANAGER'].includes(userRole.role.name.toUpperCase())) {
        return {
          success: false,
          status: 403,
          message: 'Chỉ Academic Officer hoặc Thesis Manager mới được phép thực hiện hành động này!',
        };
      }
  
      // Kiểm tra đề tài tồn tại và trạng thái hợp lệ
      const existingTopic = await prisma.topic.findUnique({
        where: { id: topicId },
        include: {
          semester: { select: { id: true, code: true } },
          topicAssignments: { select: { groupId: true } },
          majors: { select: { id: true } },
        },
      });
      if (!existingTopic) {
        return { success: false, status: 404, message: 'Đề tài không tồn tại!' };
      }
      if (!['APPROVED', 'PENDING'].includes(existingTopic.status)) {
        return {
          success: false,
          status: 400,
          message: 'Chỉ có thể gán mentor hoặc nhóm cho đề tài ở trạng thái PENDING hoặc APPROVED!',
        };
      }
  
      // Kiểm tra mentor chính và phụ không trùng nhau
      if (data.mainMentorEmail && data.subMentorEmail && data.mainMentorEmail === data.subMentorEmail) {
        return {
          success: false,
          status: 400,
          message: 'Mentor chính và mentor phụ không thể là cùng một người!',
        };
      }
  
      // Lấy cấu hình số lượng nhóm tối đa mỗi mentor
      const maxGroupsPerMentor = await this.systemConfigService.getMaxGroupsPerMentor();
      const mentorMainRole = await prisma.role.findUnique({ where: { name: 'mentor_main' } });
      const mentorSubRole = await prisma.role.findUnique({ where: { name: 'mentor_sub' } });
      if (!mentorMainRole || !mentorSubRole) {
        return {
          success: false,
          status: 500,
          message: "Vai trò 'mentor_main' hoặc 'mentor_sub' không tồn tại!",
        };
      }
  
      // Xử lý mentor chính
      let mainMentorId: string | undefined;
      let mainMentorInfo = null;
      if (data.mainMentorEmail) {
        if (!this.isValidEmail(data.mainMentorEmail)) {
          return { success: false, status: 400, message: 'Email của mentor chính không hợp lệ!' };
        }
        const mainMentor = await prisma.user.findUnique({
          where: { email: data.mainMentorEmail },
          select: { id: true, fullName: true, email: true, roles: { select: { role: { select: { name: true } } } } },
        });
        if (!mainMentor || !mainMentor.roles.some(r => r.role.name.toLowerCase() === 'lecturer')) {
          return {
            success: false,
            status: 404,
            message: 'Mentor chính không tồn tại hoặc không phải giảng viên!',
          };
        }
        mainMentorId = mainMentor.id;
        mainMentorInfo = mainMentor;
  
        const mainMentorGroupCount = await prisma.groupMentor.count({
          where: { mentorId: mainMentorId, roleId: mentorMainRole.id },
        });
        if (mainMentorGroupCount >= maxGroupsPerMentor) {
          return {
            success: false,
            status: 400,
            message: `Mentor "${mainMentor.fullName}" đã đạt số lượng nhóm tối đa (${maxGroupsPerMentor} nhóm)!`,
          };
        }
      }
  
      // Xử lý mentor phụ
      let subMentorId: string | undefined;
      let subMentorInfo = null;
      if (data.subMentorEmail) {
        if (!this.isValidEmail(data.subMentorEmail)) {
          return { success: false, status: 400, message: 'Email của mentor phụ không hợp lệ!' };
        }
        const subMentor = await prisma.user.findUnique({
          where: { email: data.subMentorEmail },
          select: { id: true, fullName: true, email: true, roles: { select: { role: { select: { name: true } } } } },
        });
        if (!subMentor || !subMentor.roles.some(r => r.role.name.toLowerCase() === 'lecturer')) {
          return {
            success: false,
            status: 404,
            message: 'Mentor phụ không tồn tại hoặc không phải giảng viên!',
          };
        }
        subMentorId = subMentor.id;
        subMentorInfo = subMentor;
  
        const subMentorGroupCount = await prisma.groupMentor.count({
          where: { mentorId: subMentorId, roleId: mentorSubRole.id },
        });
        if (subMentorGroupCount >= maxGroupsPerMentor) {
          return {
            success: false,
            status: 400,
            message: `Mentor "${subMentor.fullName}" đã đạt số lượng nhóm tối đa (${maxGroupsPerMentor} nhóm)!`,
          };
        }
      }
  
      // Xử lý nhóm
      let groupIdToUse: string | undefined = data.groupId;
      let groupInfo = null;
      if (!groupIdToUse && data.groupCode && data.semesterId) {
        const group = await prisma.group.findUnique({
          where: { semesterId_groupCode: { semesterId: data.semesterId, groupCode: data.groupCode } },
          select: { id: true, groupCode: true, status: true },
        });
        if (!group) {
          return { success: false, status: 404, message: 'Nhóm không tồn tại!' };
        }
        if (group.status !== 'ACTIVE') {
          return { success: false, status: 400, message: `Nhóm "${group.groupCode}" không ở trạng thái ACTIVE!` };
        }
        groupIdToUse = group.id;
        groupInfo = group;
      } else if (groupIdToUse) {
        const group = await prisma.group.findUnique({
          where: { id: groupIdToUse },
          select: { id: true, groupCode: true, semesterId: true, status: true },
        });
        if (!group) {
          return { success: false, status: 404, message: 'Nhóm không tồn tại!' };
        }
        if (group.status !== 'ACTIVE') {
          return { success: false, status: 400, message: `Nhóm "${group.groupCode}" không ở trạng thái ACTIVE!` };
        }
        groupIdToUse = group.id;
        groupInfo = group;
      }
  
      // Kiểm tra nhóm (nếu có)
      if (groupIdToUse) {
        const leaderRole = await prisma.role.findUnique({ where: { name: 'leader' } });
        if (!leaderRole) {
          return { success: false, status: 500, message: "Vai trò 'leader' không tồn tại." };
        }
  
        const groupLeader = await prisma.groupMember.findFirst({
          where: { groupId: groupIdToUse, roleId: leaderRole.id },
          include: { student: true },
        });
        if (!groupLeader || !groupLeader.student) {
          return { success: false, status: 400, message: 'Không tìm thấy thông tin sinh viên của trưởng nhóm.' };
        }
  
        if (groupLeader.student.majorId !== existingTopic.majors[0]?.id) {
          return { success: false, status: 400, message: 'Nhóm được chọn không cùng chuyên ngành với đề tài.' };
        }
  
        const approvedTopicForGroup = await prisma.topic.findFirst({
          where: {
            OR: [
              { proposedGroupId: groupIdToUse, status: 'APPROVED' },
              { topicAssignments: { some: { groupId: groupIdToUse, approvalStatus: 'APPROVED' } } },
            ],
          },
        });
        if (approvedTopicForGroup) {
          return { success: false, status: 400, message: 'Nhóm này đã có đề tài được duyệt hoặc được gán.' };
        }
      }
  
      // Thực hiện cập nhật trong transaction
      const result = await prisma.$transaction(async (tx) => {
        const updatedTopic = await tx.topic.update({
          where: { id: topicId },
          data: {
            mainSupervisor: mainMentorId || existingTopic.mainSupervisor,
            subSupervisor: subMentorId || existingTopic.subSupervisor,
            proposedGroupId: groupIdToUse || existingTopic.proposedGroupId,
            updatedAt: new Date(),
          },
          include: { majors: true },
        });
  
        let assignment = null;
        if (groupIdToUse) {
          if (mainMentorId) {
            await tx.groupMentor.upsert({
              where: { groupId_mentorId: { groupId: groupIdToUse, mentorId: mainMentorId } },
              update: {},
              create: { groupId: groupIdToUse, mentorId: mainMentorId, roleId: mentorMainRole.id, addedBy: updatedBy },
            });
          }
          if (subMentorId) {
            await tx.groupMentor.upsert({
              where: { groupId_mentorId: { groupId: groupIdToUse, mentorId: subMentorId } },
              update: {},
              create: { groupId: groupIdToUse, mentorId: subMentorId, roleId: mentorSubRole.id, addedBy:updatedBy },
            });
          }
          const existingAssignment = await tx.topicAssignment.findFirst({ where: { topicId, groupId: groupIdToUse } });
          if (!existingAssignment) {
            assignment = await tx.topicAssignment.create({
              data: {
                topicId,
                groupId: groupIdToUse,
                assignedBy: updatedBy,
                approvalStatus: 'APPROVED',
                defendStatus: 'NOT_SCHEDULED',
                status: 'ASSIGNED',
              },
            });
          }
        }
  
        return { topic: updatedTopic, assignment };
      });
  
      return {
        success: true,
        status: 200,
        message: 'Gán mentor và/hoặc nhóm cho đề tài thành công!',
        data: {
          topic: result.topic,
          group: groupIdToUse ? groupInfo : null,
          mainMentor: mainMentorInfo,
          subMentor: subMentorInfo,
          assignment: result.assignment ? { id: result.assignment.id, groupId: result.assignment.groupId } : null,
        },
      };
    } catch (error) {
      console.error('Lỗi khi gán mentor hoặc nhóm cho đề tài:', error);
      return {
        success: false,
        status: 500,
        message: 'Lỗi hệ thống khi gán mentor hoặc nhóm.',
      };
    }
  }






}

