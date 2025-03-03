import { PrismaClient } from "@prisma/client";
import { TOPIC_MESSAGE, GROUP_MESSAGE } from "../constants/message";
import HTTP_STATUS from "../constants/httpStatus";

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

      //  Tìm submissionPeriodId phù hợp
      const submissionPeriod = await prisma.submissionPeriod.findFirst({
        where: {
          semesterId: data.semesterId,
          OR: [
            { status: "ACTIVE" },
            { endDate: { gte: new Date() } } // Lấy đợt gần nhất chưa kết thúc
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

      //  Kiểm tra quyền của Mentor
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

      //  Tìm subSupervisor nếu chỉ có email
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

      //  Tạo topicCode
      const currentYear = new Date().getFullYear().toString().slice(-2);
      const majorCode = major.name.slice(0, 2).toUpperCase();
      const topicCount = await prisma.topic.count({ where: { semesterId: data.semesterId } });
      const topicCode = `${majorCode}-${currentYear}-${(topicCount + 1).toString().padStart(3, "0")}`;

      //  Xác định trạng thái đề tài
      const isAdmin = ["academic_officer", "admin", "graduation_thesis_manager"].includes(data.userRole);
      const topicStatus = isAdmin ? "PUBLISHED" : "PENDING";

      //  Tạo đề tài mới
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
      // Kiểm tra đề tài có tồn tại không
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
  
      // Kiểm tra quyền cập nhật
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
  
      // Nếu có groupCode, tìm groupId tương ứng
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
  
      // Nếu chỉ có subSupervisorEmail, tìm ID của mentor
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
  
      // Cập nhật thông tin đề tài (Không cập nhật `documents` trực tiếp)
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
          subSupervisor: updatedSubSupervisorId, // Cập nhật mentor
          updatedAt: new Date(),
        },
      });
  
      // Xử lý cập nhật tài liệu
      if (data.documents && data.documents.length > 0) {
        await prisma.document.deleteMany({
          where: { topicId },
        });
  
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
  
      // Cập nhật nhóm (nếu có)
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
     // Lấy danh sách đề tài theo học kỳ
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
            select: {
              group: {
                select: { id: true, groupCode: true },
              },
            },
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

  // Lấy chi tiết đề tài theo topicId
  async getTopicById(topicId: string) {
    try {
      const topic = await prisma.topic.findUnique({
        where: { id: topicId },
        include: {
          creator: { select: { fullName: true, email: true } },
          subMentor: { select: { fullName: true, email: true } },
          topicAssignments: {
            include: {
              group: { select: { id: true, groupCode: true } },
            },
          },
          documents: {
            select: { fileName: true, fileUrl: true, fileType: true },
          },
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



  //  Lấy danh sách đề tài có thể đăng ký
  async getAvailableTopics(filter: any) {
    const { semesterId, status } = filter;

    if (!semesterId) {
      return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: "Thiếu `semesterId`!" };
    }

    const topics = await prisma.topic.findMany({
      where: { semesterId, status: status || "APPROVED", topicAssignments: { none: {} } },
      select: { id: true, topicCode: true, nameVi: true, nameEn: true, description: true, status: true, createdAt: true }
    });

    return { success: true, status: HTTP_STATUS.OK, message: "Lấy danh sách đề tài thành công!", data: topics };
  }

  //  Nhóm trưởng đăng ký đề tài
  async registerTopic(data: { topicId: string; groupId: string }, leaderId: string) {
    const { topicId, groupId } = data;

    // Kiểm tra xem user có phải là leader không
    const leader = await prisma.groupMember.findFirst({
        where: { groupId, userId: leaderId, role: "leader" }
    });

    if (!leader) {
        return { 
            success: false, 
            status: HTTP_STATUS.FORBIDDEN, 
            message: "Bạn không phải là trưởng nhóm, không thể đăng ký đề tài!" 
        };
    }

    // Lấy `submissionPeriodId` từ bảng `Topic`
    const topic = await prisma.topic.findUnique({ 
        where: { id: topicId }, 
        select: { status: true, topicAssignments: true, submissionPeriodId: true }
    });

    if (!topic || topic.status !== "APPROVED" || topic.topicAssignments.length > 0) {
        return { 
            success: false, 
            status: HTTP_STATUS.FORBIDDEN, 
            message: "Đề tài không khả dụng để đăng ký!" 
        };
    }

    // Kiểm tra xem nhóm đã đăng ký đề tài này chưa
    const existingRegistration = await prisma.topicRegistration.findFirst({ 
        where: { topicId, userId: leaderId }
    });

    if (existingRegistration) {
        return { 
            success: false, 
            status: HTTP_STATUS.BAD_REQUEST, 
            message: "Nhóm của bạn đã đăng ký đề tài này rồi!" 
        };
    }

    // Đăng ký đề tài
    const registration = await prisma.topicRegistration.create({
        data: { 
            topicId, 
            userId: leaderId, 
            submissionPeriodId: topic.submissionPeriodId || "",  // Lấy từ đề tài
            role: "leader",  // Trưởng nhóm
            status: "PENDING", 
            registeredAt: new Date() 
        }
    });

    return { 
        success: true, 
        status: HTTP_STATUS.CREATED, 
        message: "Đăng ký đề tài thành công! Chờ mentor duyệt.", 
        data: registration 
    };
}



  //  Mentor duyệt nhóm đăng ký đề tài
  async approveTopicRegistration(data: { topicId: string, leaderId: string }, mentorId: string) {
    const { topicId, leaderId } = data;

    // Kiểm tra xem trưởng nhóm có đăng ký đề tài chưa
    const registration = await prisma.topicRegistration.findFirst({ 
        where: { topicId, userId: leaderId }
    });

    if (!registration) {
        return { 
            success: false, 
            status: HTTP_STATUS.NOT_FOUND, 
            message: "Nhóm này chưa đăng ký đề tài này!" 
        };
    }

    // Lấy groupId từ leaderId
    const group = await prisma.groupMember.findFirst({
        where: { userId: leaderId, role: "leader" },
        select: { groupId: true }
    });

    if (!group) {
        return { 
            success: false, 
            status: HTTP_STATUS.BAD_REQUEST, 
            message: "Không tìm thấy nhóm của trưởng nhóm này!" 
        };
    }

    // Chuyển đăng ký sang bảng TopicAssignment
    await prisma.topicAssignment.create({
        data: {
            topicId,
            groupId: group.groupId,
            assignedBy: mentorId,
            approvalStatus: "APPROVED",
            defendStatus: "NOT_SCHEDULED",  // Thêm trạng thái defend
            status: "ASSIGNED"
        }
    });

    // Cập nhật trạng thái đề tài
    await prisma.topic.update({
        where: { id: topicId },
        data: { status: "ASSIGNED" }
    });

    // Cập nhật tất cả các đăng ký khác của nhóm thành `REJECTED`
    await prisma.topicRegistration.updateMany({ 
        where: { userId: leaderId, status: "PENDING", topicId: { not: topicId } }, 
        data: { status: "REJECTED" } 
    });

    // Cập nhật trạng thái đăng ký thành `APPROVED`
    await prisma.topicRegistration.update({ 
        where: { id: registration.id }, 
        data: { status: "APPROVED" } 
    });

    return { 
        success: true, 
        status: HTTP_STATUS.OK, 
        message: "Duyệt nhóm đăng ký thành công! Các đề tài khác đã bị từ chối." 
    };
}


// danh sách đề tài cần xét duyệt 
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






  //  Hội đồng xét duyệt cập nhật trạng thái đề tài
  async updateTopicStatus(
    topicId: string, 
    data: { status: string; reason?: string }, 
    userId: string, 
    userRole: string
  ) {
    try {
      // Kiểm tra trạng thái hợp lệ
      if (!["APPROVED", "NOT APPROVED", "IMPROVE"].includes(data.status)) {
        return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: "Trạng thái không hợp lệ!" };
      }
  
      // Lấy thông tin topic
      const topic = await prisma.topic.findUnique({
        where: { id: topicId },
        select: { submissionPeriodId: true, semesterId: true },
      });
  
      if (!topic) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Không tìm thấy đề tài!" };
      }
  
      // Nếu user có vai trò admin hoặc academic_officer, cho phép cập nhật luôn
      if (userRole === "admin" || userRole === "academic_officer") {
        await prisma.topic.update({
          where: { id: topicId },
          data: { status: data.status, reviewReason: data.reason },
        });
        return { success: true, status: HTTP_STATUS.OK, message: "Cập nhật trạng thái đề tài thành công!" };
      }
  
      // Đối với các vai trò khác, xác định hội đồng áp dụng
      let councilId: string;
      if (topic.submissionPeriodId) {
        councilId = topic.submissionPeriodId;
      } else {
        councilId = topic.semesterId;
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
  
      // Dùng council.id để truy vấn bảng council_members
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
  
      // Cập nhật trạng thái của đề tài
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
        // Kiểm tra đề tài có tồn tại không
        const topic = await prisma.topic.findUnique({
          where: { id: topicId },
          select: { status: true, topicAssignments: true },
        });
  
        if (!topic) {
          return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Không tìm thấy đề tài!" };
        }
  
        // Chỉ cho phép xóa nếu đề tài chưa được duyệt
        if (topic.status !== "PENDING") {
          return { success: false, status: HTTP_STATUS.FORBIDDEN, message: "Chỉ có thể xóa đề tài ở trạng thái PENDING!" };
        }
  
        // Nếu đề tài đã được gán cho nhóm, không thể xóa
        if (topic.topicAssignments.length > 0) {
          return { success: false, status: HTTP_STATUS.FORBIDDEN, message: "Không thể xóa đề tài đã có nhóm đăng ký!" };
        }
  
        // Chỉ admin hoặc graduation_thesis_manager được phép xóa
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


//"APPROVED", "NOT APPROVED", "IMPROVE"
