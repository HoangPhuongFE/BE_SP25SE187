import { PrismaClient } from "@prisma/client";
import { TOPIC_MESSAGE, GROUP_MESSAGE } from "../constants/message";
import HTTP_STATUS from "../constants/httpStatus";
import crypto from "crypto";

const prisma = new PrismaClient();

export class TopicService {
  // Tạo đề tài mới (Mentor hoặc Admin)
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
      // Kiểm tra đầu vào cơ bản
      if (!data.semesterId) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: "Thiếu `semesterId`, vui lòng kiểm tra request!",
        };
      }

      if (!data.createdBy) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: "Thiếu `createdBy`, vui lòng kiểm tra request!",
        };
      }

      // Kiểm tra học kỳ
      const semester = await prisma.semester.findUnique({ where: { id: data.semesterId } });
      if (!semester) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: TOPIC_MESSAGE.SEMESTER_REQUIRED,
        };
      }

      // Kiểm tra ngành học
      const major = await prisma.major.findUnique({ where: { id: data.majorId } });
      if (!major) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: TOPIC_MESSAGE.INVALID_MAJOR,
        };
      }

      // Tìm đợt nộp phù hợp
      const submissionPeriod = await prisma.submissionPeriod.findFirst({
        where: {
          semesterId: data.semesterId,
          OR: [{ status: "ACTIVE" }, { endDate: { gte: new Date() } }],
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

      // Xử lý subSupervisor
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
          submissionPeriodId: submissionPeriod.id,
          isBusiness: data.isBusiness,
          businessPartner: data.businessPartner,
          source: data.source,
          subSupervisor: subSupervisorId,
          createdBy: data.createdBy,
          status: topicStatus,
          name: data.name,
        },
      });

      // Nếu mentor gán nhóm
if (data.groupId || data.groupCode) {
  let groupIdToUse: string | undefined = data.groupId;
  if (!groupIdToUse && data.groupCode) {
    const group = await prisma.group.findUnique({
      where: { groupCode: data.groupCode },
      select: { id: true, groupCode: true },
    });
    if (!group) {
      return {
        success: false,
        status: HTTP_STATUS.NOT_FOUND,
        message: GROUP_MESSAGE.GROUP_NOT_FOUND,
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
        message: GROUP_MESSAGE.GROUP_NOT_FOUND,
      };
    }
  }

  // Chỉ tạo GroupMentor nếu groupIdToUse có giá trị
  if (groupIdToUse) {
    await prisma.groupMentor.create({
      data: {
        groupId: groupIdToUse,
        mentorId: data.createdBy,
        addedBy: data.createdBy,
      },
    });
  }
}

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

  // Cập nhật đề tài
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
        select: { status: true, proposedGroupId: true },
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
          proposedGroupId: updatedGroupId || existingTopic.proposedGroupId, // Cập nhật nhóm đề xuất (nếu có)
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
      console.error("Lỗi khi cập nhật đề tài:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: TOPIC_MESSAGE.ACTION_FAILED,
      };
    }
  }



  // Cập nhật getTopicsBySemester
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
        proposedGroupId: true, // Lấy proposedGroupId (nếu chỉ cần ID)
        // Nếu cần thông tin chi tiết của nhóm, sử dụng:
        // group: { select: { id: true, groupCode: true } },
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

// Cập nhật getTopicById
async getTopicById(topicId: string) {
  try {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        creator: { select: { fullName: true, email: true } },
        subMentor: { select: { fullName: true, email: true } },
        group: { select: { id: true, groupCode: true } }, // Sử dụng group thay vì proposedGroup
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

// Cập nhật approveTopicByAcademic
async approveTopicByAcademic(
  topicId: string,
  status: "APPROVED" | "REJECTED",
  userId: string,
  userRole: string
) {
  try {
    if (!["APPROVED", "REJECTED"].includes(status)) {
      return {
        success: false,
        status: HTTP_STATUS.BAD_REQUEST,
        message: "Trạng thái không hợp lệ! Chỉ chấp nhận APPROVED hoặc REJECTED.",
      };
    }
    
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { topicRegistrations: true, group: true },
    });
    
    if (!topic || topic.status !== "PENDING") {
      return {
        success: false,
        status: HTTP_STATUS.BAD_REQUEST,
        message: "Đề tài không hợp lệ hoặc đã được duyệt!",
      };
    }
    
    // Loại bỏ đoạn kiểm tra quyền này
    // if (!["academic_officer", "admin", "graduation_thesis_manager"].includes(req.user.role)) {
    //   return {
    //     success: false,
    //     status: HTTP_STATUS.FORBIDDEN,
    //     message: "Bạn không có quyền duyệt đề tài!",
    //   };
    // }
    
    const updatedTopic = await prisma.topic.update({
      where: { id: topicId },
      data: { status },
    });
    
    if (status === "APPROVED") {
      if (topic.proposedGroupId && topic.group) {
        await prisma.topicAssignment.create({
          data: {
            topicId,
            groupId: topic.proposedGroupId,
            assignedBy: userId,
            approvalStatus: "APPROVED",
            defendStatus: "NOT_SCHEDULED",
            status: "ASSIGNED",
          },
        });
        await prisma.topic.update({
          where: { id: topicId },
          data: { proposedGroupId: null },
        });
      }
    } else if (status === "REJECTED") {
      await prisma.topic.update({
        where: { id: topicId },
        data: { proposedGroupId: null },
      });
    }
    
    return {
      success: true,
      status: HTTP_STATUS.OK,
      message: `Đề tài đã được ${status === "APPROVED" ? "duyệt" : "từ chối"}.`,
    };
  } catch (error) {
    console.error("Lỗi khi duyệt đề tài:", error);
    return {
      success: false,
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: "Lỗi hệ thống khi duyệt đề tài.",
    };
  }
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
  
    // Tự động tìm groupId từ leaderId
    console.log(`🔎 Đang kiểm tra leader cho userId: ${leaderId}`);
  
    const leader = await prisma.groupMember.findFirst({
      where: {
        OR: [
          { userId: leaderId },
          { studentId: (await prisma.student.findUnique({ where: { userId: leaderId } }))?.id },
        ],
        role: "leader",
      },
      select: { groupId: true },
    });
  
    if (!leader) {
      console.log(`❌ User ${leaderId} không phải leader của bất kỳ nhóm nào`);
      return {
        success: false,
        status: HTTP_STATUS.FORBIDDEN,
        message: "Bạn không phải là trưởng nhóm, không thể đăng ký đề tài!",
      };
    }
  
    console.log(`✅ ${leaderId} là leader của nhóm ${leader.groupId}`);
    const groupId = leader.groupId;
  
    // Tìm đề tài dựa trên topicId hoặc topicCode
    let topic;
    if (topicId) {
      topic = await prisma.topic.findUnique({
        where: { id: topicId },
        select: { id: true, status: true, topicAssignments: true, submissionPeriodId: true, topicCode: true, proposedGroupId: true }, // Thêm proposedGroupId
      });
    } else if (topicCode) {
      topic = await prisma.topic.findUnique({
        where: { topicCode },
        select: { id: true, status: true, topicAssignments: true, submissionPeriodId: true, topicCode: true, proposedGroupId: true }, // Thêm proposedGroupId
      });
    }
  
    if (!topic) {
      console.log(`❌ Đề tài không tồn tại (topicId: ${topicId}, topicCode: ${topicCode})`);
      return {
        success: false,
        status: HTTP_STATUS.NOT_FOUND,
        message: "Đề tài không tồn tại!",
      };
    }
  
    if (topic.status !== "APPROVED") {
      console.log(`❌ Đề tài ${topicId || topicCode} chưa được duyệt (status: ${topic.status})`);
      return {
        success: false,
        status: HTTP_STATUS.FORBIDDEN,
        message: "Đề tài chưa được duyệt, không thể đăng ký!",
      };
    }
  
    if (topic.topicAssignments.length > 0) {
      console.log(`❌ Đề tài ${topicId || topicCode} đã được gán cho nhóm khác`);
      return {
        success: false,
        status: HTTP_STATUS.FORBIDDEN,
        message: "Đề tài đã được gán cho nhóm khác, không thể đăng ký!",
      };
    }
  
    if (topic.proposedGroupId) {
      console.log(`❌ Đề tài ${topicId || topicCode} đã được mentor đề xuất gán cho nhóm khác`);
      return {
        success: false,
        status: HTTP_STATUS.FORBIDDEN,
        message: "Đề tài đã được mentor đề xuất gán cho nhóm khác, không thể đăng ký!",
      };
    }
  
    // Kiểm tra xem nhóm đã đăng ký đề tài này chưa
    const existingRegistration = await prisma.topicRegistration.findFirst({
      where: { topicId: topic.id, userId: leaderId },
    });
  
    if (existingRegistration) {
      console.log(`❌ Nhóm của leader ${leaderId} đã đăng ký đề tài ${topic.id || topicCode}`);
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
  
    console.log(`✅ Đăng ký đề tài thành công cho leader ${leaderId}, topic ${topic.id} (code: ${topic.topicCode}), group ${groupId}`);
  
    return {
      success: true,
      status: HTTP_STATUS.CREATED,
      message: "Đăng ký đề tài thành công! Chờ mentor duyệt.",
      data: registration,
    };
  }

  // Mentor duyệt đăng ký đề tài
  async approveTopicRegistrationByMentor(
    registrationId: string,
    data: { status: "APPROVED" | "REJECTED"; reason?: string },
    userId: string,
    userRole: string
  ) {
    try {
      console.log(` Bắt đầu duyệt đăng ký đề tài | ID: ${registrationId}`);
  
      //  Kiểm tra trạng thái hợp lệ
      if (!["APPROVED", "REJECTED"].includes(data.status)) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: "Trạng thái không hợp lệ! Chỉ chấp nhận APPROVED hoặc REJECTED.",
        };
      }
  
      //  Lấy thông tin đăng ký đề tài
      const registration = await prisma.topicRegistration.findUnique({
        where: { id: registrationId },
        include: {
          topic: {
            select: { id: true, createdBy: true, submissionPeriodId: true, status: true, proposedGroupId: true },
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
  
      //  Kiểm tra quyền mentor
      if (userRole !== "mentor" || registration.topic.createdBy !== userId) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Bạn không có quyền duyệt đăng ký này! Chỉ mentor tạo đề tài mới có quyền.",
        };
      }
  
      //  Kiểm tra trạng thái đề tài (phải được duyệt mới có thể tiếp tục)
      if (registration.topic.status !== "APPROVED") {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Đề tài chưa được duyệt, không thể duyệt đăng ký!",
        };
      }
  
      // 🔹 Kiểm tra trạng thái đăng ký (chỉ PENDING mới được duyệt)
      if (registration.status !== "PENDING") {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Chỉ có thể duyệt đăng ký ở trạng thái PENDING!",
        };
      }
  
      //  Cập nhật trạng thái đăng ký
      const updatedRegistration = await prisma.topicRegistration.update({
        where: { id: registrationId },
        data: {
          status: data.status,
          decisionFile: data.reason || null,
          reviewedAt: new Date(),
          reviewerId: userId,
        },
      });
  
      //  Nếu từ chối -> Trả về ngay
      if (data.status === "REJECTED") {
        return {
          success: true,
          status: HTTP_STATUS.OK,
          message: "Đã từ chối đăng ký đề tài!",
          data: updatedRegistration,
        };
      }
  
      // 🔹 Nếu duyệt (APPROVED), kiểm tra nhóm leader
      const student = await prisma.student.findFirst({
        where: { userId: registration.userId },
        select: { id: true },
      });
  
      const leaderGroup = await prisma.groupMember.findFirst({
        where: {
          OR: [{ studentId: student?.id }, { userId: registration.userId }],
          role: "leader",
        },
        select: { groupId: true },
      });
  
      if (!leaderGroup) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Không tìm thấy nhóm của leader!",
        };
      }
  
      //  Kiểm tra xem topic đã có group assignment chưa
      const existingAssignment = await prisma.topicAssignment.findFirst({
        where: { topicId: registration.topicId },
      });
  
      if (!existingAssignment) {
        //  Nếu chưa có, tạo TopicAssignment
        await prisma.topicAssignment.create({
          data: {
            topicId: registration.topicId,
            groupId: leaderGroup.groupId,
            assignedBy: userId,
            approvalStatus: "APPROVED",
            defendStatus: "NOT_SCHEDULED",
            status: "ASSIGNED",
          },
        });
  
        //  Thêm mentor vào nhóm (nếu chưa có)
        await prisma.groupMentor.upsert({
          where: {
            groupId_mentorId: {
              groupId: leaderGroup.groupId,
              mentorId: userId,
            },
          },
          update: {},
          create: {
            groupId: leaderGroup.groupId,
            mentorId: userId,
            addedBy: userId,
          },
        });
      }
  
      //  Lấy thông tin user (leader)
      const user = await prisma.user.findUnique({
        where: { id: registration.userId },
        select: { fullName: true, email: true },
      });
  
      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: "Duyệt đăng ký đề tài thành công!",
        data: {
          ...updatedRegistration,
          user,
        },
      };
    } catch (error) {
      console.error(" Lỗi khi mentor duyệt đăng ký đề tài:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống khi duyệt đăng ký đề tài.",
        error: error instanceof Error ? error.message : error,
      };
    }
  }
  

 

 


  // Xóa đề tài
  async deleteTopic(topicId: string, userRole: string) {
    try {
      const topic = await prisma.topic.findUnique({
        where: { id: topicId },
        select: { status: true, topicAssignments: true, proposedGroupId: true },
      });
      if (!topic) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Không tìm thấy đề tài!" };
      }

      if (topic.status !== "PENDING") {
        return { success: false, status: HTTP_STATUS.FORBIDDEN, message: "Chỉ có thể xóa đề tài ở trạng thái PENDING!" };
      }

      if (topic.topicAssignments.length > 0 || topic.proposedGroupId) {
        return { success: false, status: HTTP_STATUS.FORBIDDEN, message: "Không thể xóa đề tài đã có nhóm đề xuất hoặc đăng ký!" };
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



  //  getTopicsForApprovalBySubmission
async getTopicsForApprovalBySubmission(query: { submissionPeriodId?: string; round?: number; semesterId?: string; }) {
  try {
    console.log("Bắt đầu lấy danh sách đề tài cần duyệt:", query);

    let submissionPeriodId: string;
    if (query.submissionPeriodId) {
      submissionPeriodId = query.submissionPeriodId;
      // Kiểm tra xem submissionPeriodId có hợp lệ không
      const submissionPeriod = await prisma.submissionPeriod.findUnique({
        where: { id: submissionPeriodId },
        select: { id: true },
      });
      if (!submissionPeriod) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Không tìm thấy đợt xét duyệt với submissionPeriodId đã chỉ định!",
        };
      }
    } else if (query.round !== undefined && query.semesterId) {
      // Kiểm tra semesterId hợp lệ trước
      const semester = await prisma.semester.findUnique({ where: { id: query.semesterId }, select: { id: true } });
      if (!semester) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Không tìm thấy học kỳ với semesterId đã chỉ định!",
        };
      }

      // Tìm submissionPeriod dựa trên round và semesterId
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

    // Lấy danh sách đề tài với include nhóm đề xuất
    const topics = await prisma.topic.findMany({
      where: {
        submissionPeriodId,
        status: "PENDING",
      },
      include: {
        group: { select: { groupCode: true, id: true } }, // Thêm id để debug hoặc sử dụng sau
      },
    });

    if (topics.length === 0) {
      console.log(`Không tìm thấy đề tài nào trong submissionPeriodId: ${submissionPeriodId}`);
      return {
        success: false,
        status: HTTP_STATUS.NOT_FOUND,
        message: "Không tìm thấy đề tài nào trong đợt xét duyệt!",
      };
    }

    console.log(`Đã tìm thấy ${topics.length} đề tài cần duyệt`);
    return {
      success: true,
      status: HTTP_STATUS.OK,
      data: topics,
    };
  } catch (error) {
    console.error("Lỗi khi lấy danh sách đề tài cần duyệt:", error);
    return {
      success: false,
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: "Lỗi hệ thống khi lấy danh sách đề tài cần duyệt!",
    };
  }
}
  // Lấy danh sách đề tài có thể đăng ký (cho sinh viên)
  async getAvailableTopics(filter: any) {
    const { semesterId, status } = filter;
    console.log(`Bắt đầu lấy danh sách đề tài khả dụng - semesterId: ${semesterId}, status: ${status}`);
  
    if (!semesterId) {
      console.log("Thiếu semesterId trong filter");
      return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: "Thiếu `semesterId`!" };
    }
  
    // Chỉ lấy đề tài có status là "APPROVED" hoặc giá trị status từ filter
    console.log(`Truy vấn đề tài với: semesterId=${semesterId}, status=${status || "APPROVED"}`);
    const topics = await prisma.topic.findMany({
      where: {
        semesterId,
        status: status || "APPROVED", // Chỉ lấy đề tài đã được duyệt
      },
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
  
    console.log(`Tìm thấy ${topics.length} đề tài từ truy vấn`);
    console.log("Danh sách đề tài:", JSON.stringify(topics, null, 2));
  
    // Kiểm tra nếu không có đề tài nào
    if (topics.length === 0) {
      console.log(`Không tìm thấy đề tài khả dụng trong semesterId: ${semesterId} với status: ${status || "APPROVED"}`);
      return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Không tìm thấy đề tài khả dụng!" };
    }
  
    console.log(`Trả về danh sách đề tài khả dụng`);
    return { 
      success: true, 
      status: HTTP_STATUS.OK, 
      message: "Lấy danh sách đề tài thành công!", 
      data: topics 
    };
  }




  async getRegisteredTopicsByMentor(mentorId: string) {
    try {
      console.log(`🔍 Đang lấy danh sách đề tài đã được đăng ký cho mentor: ${mentorId}`);
  
      // 🔹 Lấy danh sách đề tài mà mentor đã tạo và có nhóm đăng ký
      const registeredTopics = await prisma.topic.findMany({
        where: {
          createdBy: mentorId, // Chỉ lấy đề tài được tạo bởi mentor này
          topicRegistrations: { some: { status: "APPROVED" } }, // Chỉ lấy đề tài đã được nhóm đăng ký
        },
        select: {
          id: true,
          topicCode: true,
          nameVi: true,
          nameEn: true,
          description: true,
          status: true,
          createdAt: true,
          topicRegistrations: {
            select: {
              id: true,
              status: true,
              registeredAt: true,
              userId: true, // 🔹 Lấy userId
              topicId: true, // 🔹 Lấy topicId để đối chiếu
            },
          },
        },
      });
  
      // 🔹 Lấy danh sách `userId` từ `topicRegistrations`
      const userIds = [
        ...new Set(registeredTopics.flatMap(topic =>
          topic.topicRegistrations.map(reg => reg.userId)
        )),
      ];
  
      // 🔹 Truy vấn danh sách `User`
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true, email: true },
      });
  
      // 🔹 Lấy danh sách nhóm đã đăng ký
      const topicIds = registeredTopics.map(topic => topic.id);
      const groupAssignments = await prisma.topicAssignment.findMany({
        where: { topicId: { in: topicIds } },
        select: {
          topicId: true,
          group: { select: { id: true, groupCode: true } },
        },
      });
  
      // 🔹 Gán thông tin `User` và `Group` vào `topicRegistrations`
      const topicsWithUsers = registeredTopics.map(topic => ({
        ...topic,
        topicRegistrations: topic.topicRegistrations.map(reg => ({
          ...reg,
          user: users.find(user => user.id === reg.userId) || null, // Gán user
          group: groupAssignments.find(group => group.topicId === topic.id)?.group || null, // Gán group
        })),
      }));
  
      console.log(`✅ Tìm thấy ${topicsWithUsers.length} đề tài đã được nhóm đăng ký.`);
      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: "Lấy danh sách đề tài đã đăng ký thành công!",
        data: topicsWithUsers,
      };
    } catch (error) {
      console.error("❌ Lỗi khi lấy danh sách đề tài đã đăng ký:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống khi lấy danh sách đề tài đã đăng ký!",
      };
    }
  }
  
  
  




  
}