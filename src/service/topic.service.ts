import { PrismaClient } from "@prisma/client";
import { TOPIC_MESSAGE, GROUP_MESSAGE } from "../constants/message";
import HTTP_STATUS from "../constants/httpStatus";
import crypto from "crypto";

const prisma = new PrismaClient();

export class TopicService {
  async createTopic(data: {
    nameVi: string;
    nameEn: string;
    description: string;
    semesterId: string;
    majorId: string;
    isBusiness: boolean;
    businessPartner?: string;
    source?: string;
    subSupervisor?: string;
    subSupervisorEmail?: string;
    name: string;
    createdBy: string;
    userRole: string;
    documents?: { fileName: string; fileUrl: string; fileType: string }[];
    groupId?: string;
    groupCode?: string;
  }) {
    try {
      if (!data.semesterId) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: "Thiếu `semesterId`, vui lòng kiểm tra request!",
        };
      }

      const semester = await prisma.semester.findUnique({
        where: { id: data.semesterId },
      });
      if (!semester) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: TOPIC_MESSAGE.SEMESTER_REQUIRED,
        };
      }

      const major = await prisma.major.findUnique({
        where: { id: data.majorId },
      });
      if (!major) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: TOPIC_MESSAGE.INVALID_MAJOR,
        };
      }

      // Tìm submissionPeriodId phù hợp
      const submissionPeriod = await prisma.submissionPeriod.findFirst({
        where: {
          semesterId: data.semesterId,
          OR: [
            { status: "ACTIVE" },
            { endDate: { gte: new Date() } }
          ]
        },
        orderBy: { startDate: "asc" },
        select: { id: true, status: true },
      });
      if (!submissionPeriod) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Không tìm thấy đợt xét duyệt phù hợp!",
        };
      }

      // Kiểm tra quyền của Mentor
      const isMentor = data.userRole === "mentor";
      if (isMentor && submissionPeriod.status !== "ACTIVE") {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Hiện tại không có đợt đề xuất nào đang mở. Vui lòng kiểm tra lại!",
        };
      }

      if (!data.createdBy) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: "Thiếu `createdBy`, vui lòng kiểm tra request!",
        };
      }

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
            message: TOPIC_MESSAGE.INVALID_REVIEWER,
          };
        }
        subSupervisorId = mentor.id;
      }

      // Tạo topicCode
      const currentYear = new Date().getFullYear().toString().slice(-2);
      const majorCode = major.name.slice(0, 2).toUpperCase();
      const topicCount = await prisma.topic.count({ where: { semesterId: data.semesterId } });
      const topicCode = `${majorCode}-${currentYear}-${(topicCount + 1).toString().padStart(3, "0")}`;

      // Xác định trạng thái đề tài
      const isAdmin = ["academic_officer", "admin", "graduation_thesis_manager"].includes(data.userRole);
      const topicStatus = isAdmin ? "PUBLISHED" : "PENDING";

      // Tạo đề tài mới
      const newTopic = await prisma.topic.create({
        data: {
          topicCode,
          nameVi: data.nameVi,
          nameEn: data.nameEn,
          description: data.description,
          semesterId: data.semesterId,
          submissionPeriodId: submissionPeriod.id, // Gán submissionPeriodId
          isBusiness: data.isBusiness,
          businessPartner: data.businessPartner,
          source: data.source,
          subSupervisor: subSupervisorId,
          createdBy: data.createdBy,
          status: topicStatus,
          name: data.name,
        },
      });

      return {
        success: true,
        status: HTTP_STATUS.CREATED,
        message: TOPIC_MESSAGE.TOPIC_CREATED,
        data: newTopic,
      };
    } catch (error) {
      console.error("Lỗi khi tạo đề tài:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống khi tạo đề tài.",
      };
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
    },
    userRole: string
  ) {
    try {
      const existingTopic = await prisma.topic.findUnique({
        where: { id: topicId },
      });
      if (!existingTopic) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: TOPIC_MESSAGE.TOPIC_NOT_FOUND,
        };
      }

      const isMentor = userRole === "mentor";
      const isAdmin = ["academic_officer", "admin", "graduation_thesis_manager"].includes(userRole);
      if (isMentor && existingTopic.status !== "PENDING") {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: TOPIC_MESSAGE.UNAUTHORIZED_UPDATE,
        };
      }

      let updatedGroupId = data.groupId;
      if (!updatedGroupId && data.groupCode) {
        const group = await prisma.group.findUnique({
          where: { groupCode: data.groupCode },
          select: { id: true },
        });
        if (!group) {
          return {
            success: false,
            status: HTTP_STATUS.NOT_FOUND,
            message: GROUP_MESSAGE.GROUP_NOT_FOUND,
          };
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
          return {
            success: false,
            status: HTTP_STATUS.NOT_FOUND,
            message: TOPIC_MESSAGE.INVALID_REVIEWER,
          };
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

      const existingAssignment = await prisma.topicAssignment.findFirst({
        where: { topicId },
      });
      if (updatedGroupId) {
        if (existingAssignment) {
          await prisma.topicAssignment.update({
            where: { id: existingAssignment.id },
            data: { groupId: updatedGroupId, assignedBy: data.updatedBy },
          });
        } else {
          await prisma.topicAssignment.create({
            data: {
              topicId,
              groupId: updatedGroupId,
              assignedBy: data.updatedBy,
              approvalStatus: "PENDING",
              defendStatus: "NOT_SCHEDULED",
              status: "ASSIGNED",
            },
          });
        }
      }

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: TOPIC_MESSAGE.TOPIC_UPDATED,
        data: updatedTopic,
      };
    } catch (error) {
      console.error("Lỗi khi cập nhật đề tài:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: TOPIC_MESSAGE.ACTION_FAILED,
      };
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
          subMentor: { select: { fullName: true, email: true } },
          creator: { select: { fullName: true, email: true } },
          topicAssignments: {
            select: { group: { select: { id: true, groupCode: true } } },
          },
        },
      });
      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: "Lấy danh sách đề tài thành công.",
        data: topics,
      };
    } catch (error) {
      console.error("Lỗi khi lấy danh sách đề tài:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi khi lấy danh sách đề tài.",
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
          topicAssignments: { include: { group: { select: { id: true, groupCode: true } } } },
          documents: { select: { fileName: true, fileUrl: true, fileType: true } },
        },
      });
      if (!topic) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Không tìm thấy đề tài.",
        };
      }
      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: "Lấy thông tin đề tài thành công.",
        data: topic,
      };
    } catch (error) {
      console.error("Lỗi khi lấy thông tin đề tài:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi khi lấy thông tin đề tài.",
      };
    }
  }

  // Lấy danh sách đề tài có thể đăng ký (cho sinh viên)
  async getAvailableTopics(filter: any) {
    const { semesterId, status } = filter;
    if (!semesterId) {
      return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: "Thiếu `semesterId`!" };
    }
    const topics = await prisma.topic.findMany({
      where: {
        semesterId,
        // Chỉ lấy đề tài đã được duyệt (APPROVED hoặc PUBLISHED)
        status: status || "APPROVED",
        // Không có đăng ký nhóm
        topicAssignments: { none: {} },
      },
      select: {
        id: true,
        topicCode: true,
        nameVi: true,
        nameEn: true,
        description: true,
        status: true,
        createdAt: true,
      },
    });
    return { success: true, status: HTTP_STATUS.OK, message: "Lấy danh sách đề tài thành công!", data: topics };
  }

  // Nhóm trưởng đăng ký đề tài
async registerTopic(data: { topicId?: string; topicCode?: string }, leaderId: string) {
    const { topicId, topicCode } = data;
  
    // Kiểm tra nếu không có topicId hoặc topicCode
    if (!topicId && !topicCode) {
      return {
        success: false,
        status: HTTP_STATUS.BAD_REQUEST,
        message: "Thiếu topicId hoặc topicCode để đăng ký!",
      };
    }
  
    // Tự động tìm groupId từ leaderId (kiểm tra xem leaderId có phải là leader của nhóm nào không)
  
    // Kiểm tra xem người dùng có phải là leader của bất kỳ nhóm nào không
    const leader = await prisma.groupMember.findFirst({
      where: {
        OR: [
          { userId: leaderId }, // Kiểm tra userId
          { studentId: (await prisma.student.findUnique({ where: { userId: leaderId } }))?.id }, // Kiểm tra studentId
        ],
        role: "leader", // Chỉ lấy bản ghi với vai trò leader
      },
      select: { groupId: true }, // Chỉ lấy groupId
    });
  
    if (!leader) {
      return {
        success: false,
        status: HTTP_STATUS.FORBIDDEN,
        message: "Bạn không phải là trưởng nhóm, không thể đăng ký đề tài!",
      };
    }
  
    // Lấy groupId từ kết quả
    const groupId = leader.groupId;
  
    // Tìm đề tài dựa trên topicId hoặc topicCode
    let topic;
    if (topicId) {
      topic = await prisma.topic.findUnique({
        where: { id: topicId },
        select: { id: true, status: true, topicAssignments: true, submissionPeriodId: true, topicCode: true },
      });
    } else if (topicCode) {
      topic = await prisma.topic.findUnique({
        where: { topicCode },
        select: { id: true, status: true, topicAssignments: true, submissionPeriodId: true, topicCode: true },
      });
    }
  
    if (!topic) {
      return {
        success: false,
        status: HTTP_STATUS.NOT_FOUND,
        message: "Đề tài không tồn tại!",
      };
    }
  
    if (topic.status !== "APPROVED") {
      return {
        success: false,
        status: HTTP_STATUS.FORBIDDEN,
        message: "Đề tài chưa được duyệt, không thể đăng ký!",
      };
    }
  
    if (topic.topicAssignments.length > 0) {
      return {
        success: false,
        status: HTTP_STATUS.FORBIDDEN,
        message: "Đề tài đã được gán cho nhóm khác, không thể đăng ký!",
      };
    }
  
    // Kiểm tra xem nhóm đã đăng ký đề tài này chưa
    const existingRegistration = await prisma.topicRegistration.findFirst({
      where: { topicId: topic.id, userId: leaderId }, // Dùng topic.id
    });
  
    if (existingRegistration) {
      return {
        success: false,
        status: HTTP_STATUS.BAD_REQUEST,
        message: "Nhóm của bạn đã đăng ký đề tài này rồi!",
      };
    }
  
    // Tạo mới đăng ký đề tài cho nhóm
    const registration = await prisma.topicRegistration.create({
      data: {
        topicId: topic.id,
        userId: leaderId,
        submissionPeriodId: topic.submissionPeriodId || "",
        role: "leader",
        status: "PENDING",
        registeredAt: new Date(),
      },
    });
  
    return {
      success: true,
      status: HTTP_STATUS.CREATED,
      message: "Đăng ký đề tài thành công! Chờ mentor duyệt.",
      data: registration,
    };
  }
  

  async approveTopicRegistrationByMentor(
    registrationId: string,
    data: { status: string; reason?: string },
    userId: string,
    userRole: string
) {
    try {
        // Kiểm tra trạng thái hợp lệ
        if (!["APPROVED", "REJECTED"].includes(data.status)) {
            return {
                success: false,
                status: HTTP_STATUS.BAD_REQUEST,
                message: "Trạng thái không hợp lệ! Chỉ chấp nhận APPROVED hoặc REJECTED.",
            };
        }

        // Lấy thông tin đăng ký đề tài
        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                topic: {
                    select: { id: true, createdBy: true, submissionPeriodId: true, status: true },
                },
            },
        });

        if (!registration) {
            return {
                success: false,
                status: HTTP_STATUS.NOT_FOUND,
                message: "Không tìm thấy đăng ký đề tài!",
            };
        }

        // Kiểm tra quyền: Chỉ mentor (người tạo đề tài) mới có quyền duyệt đăng ký đề tài này
        if (userRole !== "mentor" || registration.topic.createdBy.toLowerCase().trim() !== userId.toLowerCase().trim()) {
            return {
                success: false,
                status: HTTP_STATUS.FORBIDDEN,
                message: "Bạn không có quyền duyệt đăng ký này! Chỉ mentor tạo đề tài mới có quyền.",
            };
        }

        // Kiểm tra trạng thái đề tài: Đề tài phải ở trạng thái APPROVED để có thể duyệt đăng ký
        if (registration.topic.status !== "APPROVED") {
            return {
                success: false,
                status: HTTP_STATUS.FORBIDDEN,
                message: "Đề tài chưa được duyệt, không thể duyệt đăng ký!",
            };
        }

        // Kiểm tra trạng thái đăng ký: Chỉ duyệt được khi ở trạng thái PENDING
        if (registration.status !== "PENDING") {
            return {
                success: false,
                status: HTTP_STATUS.FORBIDDEN,
                message: "Chỉ có thể duyệt đăng ký ở trạng thái PENDING!",
            };
        }

        // Cập nhật trạng thái đăng ký
        const updatedRegistration = await prisma.topicRegistration.update({
            where: { id: registrationId },
            data: {
                status: data.status,
                decisionFile: data.reason || null,
                reviewedAt: new Date(),
                reviewerId: userId,
            },
            include: { topic: true },
        });

        // Lấy groupId từ groupMember dựa trên userId của leader
        const student = await prisma.student.findFirst({
            where: { userId: registration.userId },
            select: { id: true },
        });

        const leaderGroup = await prisma.groupMember.findFirst({
            where: {
                OR: [
                    { studentId: student?.id }, // Dùng student.id nếu có
                    { userId: registration.userId },
                ],
                role: "leader",
            },
            select: { groupId: true },
        });

        if (!leaderGroup && data.status === "APPROVED") {
            return {
                success: false,
                status: HTTP_STATUS.NOT_FOUND,
                message: "Không tìm thấy nhóm của leader!",
            };
        }

        // (Tùy chọn) Cập nhật trạng thái đề tài hoặc tạo topicAssignment nếu được duyệt
        if (data.status === "APPROVED") {
            const existingAssignment = await prisma.topicAssignment.findFirst({
                where: { topicId: registration.topicId },
            });

            if (!existingAssignment) {
                await prisma.topicAssignment.create({
                    data: {
                        topicId: registration.topicId,
                        groupId: leaderGroup!.groupId,
                        assignedBy: userId,
                        approvalStatus: "APPROVED",
                        defendStatus: "NOT_SCHEDULED",
                        status: "ASSIGNED",
                    },
                });
            }
        }

        // Lấy thông tin user (leader) để trả về trong response
        const user = await prisma.user.findUnique({
            where: { id: registration.userId },
            select: { fullName: true, email: true },
        });

        return {
            success: true,
            status: HTTP_STATUS.OK,
            message: `Duyệt đăng ký đề tài ${data.status === "APPROVED" ? "thành công" : "bị từ chối"}!`,
            data: {
                ...updatedRegistration,
                user: user,
            },
        };
    } catch (error) {
        console.error("Lỗi khi mentor duyệt đăng ký đề tài:", error);
        return {
            success: false,
            status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
            message: "Lỗi hệ thống khi duyệt đăng ký đề tài.",
        };
    }
}


  // Lấy danh sách đề tài cần duyệt (cho hội đồng)
  async getTopicsForApprovalBySubmission(query: { submissionPeriodId?: string; round?: number; semesterId?: string; }) {
    try {
      let submissionPeriodId: string;
      if (query.submissionPeriodId) {
        submissionPeriodId = query.submissionPeriodId;
      } else if (query.round !== undefined && query.semesterId) {
        const submissionPeriod = await prisma.submissionPeriod.findFirst({
          where: {
            semesterId: query.semesterId,
            roundNumber: query.round,
          },
          select: { id: true },
        });
        if (!submissionPeriod) {
          return {
            success: false,
            status: HTTP_STATUS.NOT_FOUND,
            message: "Không tìm thấy đợt xét duyệt với round đã chỉ định!",
          };
        }
        submissionPeriodId = submissionPeriod.id;
      } else {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: "Thiếu submissionPeriodId hoặc round và semesterId!",
        };
      }
      const topics = await prisma.topic.findMany({
        where: {
          submissionPeriodId,
          status: "PENDING",
        },
      });
      if (topics.length === 0) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Không tìm thấy đề tài nào trong đợt xét duyệt!",
        };
      }
      return { success: true, status: HTTP_STATUS.OK, data: topics };
    } catch (error) {
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi khi lấy danh sách đề tài!",
      };
    }
  }

  // Hội đồng xét duyệt cập nhật trạng thái đề tài
  async updateTopicStatus(
    topicId: string,
    data: { status: string; reason?: string },
    userId: string,
    userRole: string
  ) {
    try {
      if (!["APPROVED", "NOT APPROVED", "IMPROVE"].includes(data.status)) {
        return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: "Trạng thái không hợp lệ!" };
      }
      const topic = await prisma.topic.findUnique({
        where: { id: topicId },
        select: { submissionPeriodId: true, semesterId: true },
      });
      if (!topic) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Không tìm thấy đề tài!" };
      }
      if (userRole === "admin" || userRole === "academic_officer") {
        await prisma.topic.update({
          where: { id: topicId },
          data: { status: data.status, reviewReason: data.reason },
        });
        return { success: true, status: HTTP_STATUS.OK, message: "Cập nhật trạng thái đề tài thành công!" };
      }
      // Tìm hội đồng topic dựa trên submissionPeriodId và type "topic"
      const council = await prisma.council.findFirst({
        where: {
          submissionPeriodId: topic.submissionPeriodId,
          type: "topic"
        },
        select: { id: true }
      });
      if (!council) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Không tìm thấy hội đồng duyệt đề tài tương ứng!"
        };
      }
      const councilMembers = await prisma.councilMember.findMany({
        where: { councilId: council.id },
        select: { userId: true, role: true },
      });
      const isReviewer = councilMembers.some(
        (member) => member.userId === userId && member.role === 'reviewer'
      );
      if (!isReviewer) {
        return { success: false, status: HTTP_STATUS.FORBIDDEN, message: "Bạn không có quyền cập nhật trạng thái của đề tài!" };
      }
      await prisma.topic.update({
        where: { id: topicId },
        data: { status: data.status, reviewReason: data.reason },
      });
      return { success: true, status: HTTP_STATUS.OK, message: "Cập nhật trạng thái đề tài thành công!" };
    } catch (error) {
      console.error("Lỗi khi cập nhật trạng thái đề tài:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống khi cập nhật trạng thái đề tài." };
    }
  }

  async deleteTopic(topicId: string, userRole: string) {
    try {
      const topic = await prisma.topic.findUnique({
        where: { id: topicId },
        select: { status: true, topicAssignments: true },
      });
      if (!topic) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Không tìm thấy đề tài!" };
      }
      if (topic.status !== "PENDING") {
        return { success: false, status: HTTP_STATUS.FORBIDDEN, message: "Chỉ có thể xóa đề tài ở trạng thái PENDING!" };
      }
      if (topic.topicAssignments.length > 0) {
        return { success: false, status: HTTP_STATUS.FORBIDDEN, message: "Không thể xóa đề tài đã có nhóm đăng ký!" };
      }
      if (!["admin", "graduation_thesis_manager"].includes(userRole)) {
        return { success: false, status: HTTP_STATUS.FORBIDDEN, message: "Bạn không có quyền xóa đề tài!" };
      }
      await prisma.topic.delete({ where: { id: topicId } });
      return { success: true, status: HTTP_STATUS.OK, message: "Xóa đề tài thành công!" };
    } catch (error) {
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi khi xóa đề tài!" };
    }
  }
}
