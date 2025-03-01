import { PrismaClient } from "@prisma/client";
import { TOPIC_MESSAGE ,GROUP_MESSAGE  } from "../constants/message";

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
      // Kiểm tra học kỳ
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
  
      // Kiểm tra ngành học
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
  
      let groupId = data.groupId;
  
      // Nếu groupCode được gửi, tìm groupId tương ứng
      if (!groupId && data.groupCode) {
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
  
        groupId = group.id;
      }
  
      let subSupervisorId = data.subSupervisor;
  
      // Nếu chỉ có subSupervisorEmail, tìm ID của mentor
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
  
      // Xác định trạng thái dựa vào vai trò người tạo
      const isPublic = ["academic_officer", "graduation_thesis_manager"].includes(data.userRole);
      const topicStatus = isPublic ? "PUBLISHED" : "PENDING";
  
      // Sinh mã topicCode theo format: "<Mã ngành>-<Năm>-<Số thứ tự>"
      const currentYear = new Date().getFullYear().toString().slice(-2);
      const majorCode = major.name.slice(0, 2).toUpperCase();
      const topicCount = await prisma.topic.count({ where: { semesterId: data.semesterId } });
      const topicCode = `${majorCode}-${currentYear}-${(topicCount + 1).toString().padStart(3, "0")}`;
  
      // Tạo đề tài mới
      const newTopic = await prisma.topic.create({
        data: {
          topicCode,
          nameVi: data.nameVi,
          nameEn: data.nameEn,
          description: data.description,
          semesterId: data.semesterId,
          isBusiness: data.isBusiness,
          businessPartner: data.businessPartner,
          source: data.source,
          subSupervisor: subSupervisorId,
          createdBy: data.createdBy,
          status: topicStatus,
          name: data.name,
        },
      });
  
      // Nếu có tài liệu đính kèm, lưu vào bảng Document
      if (data.documents && data.documents.length > 0) {
        const documentData = data.documents.map((doc) => ({
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          fileType: doc.fileType,
          uploadedBy: data.createdBy,
          topicId: newTopic.id,
        }));
  
        await prisma.document.createMany({ data: documentData });
      }
  
      // Nếu có nhóm được truyền vào, gán nhóm vào đề tài
      if (groupId) {
        await prisma.topicAssignment.create({
          data: {
            topicId: newTopic.id,
            groupId: groupId,
            assignedBy: data.createdBy,
            approvalStatus: "PENDING",
            defendStatus: "NOT_SCHEDULED",
            status: "ASSIGNED",
          },
        });
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
        message: TOPIC_MESSAGE.TOPIC_CREATION_FAILED,
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
  }

  


