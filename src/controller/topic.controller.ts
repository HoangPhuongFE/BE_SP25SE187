import { Request, Response } from "express";
import { TopicService } from "../service/topic.service";
import { TOPIC_MESSAGE ,GROUP_MESSAGE } from "../constants/message";
import HTTP_STATUS from "../constants/httpStatus";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const topicService = new TopicService();

export class TopicController {
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
  
      // Kiểm tra thời gian SubmissionPeriod
      const activeSubmissionPeriod = await prisma.submissionPeriod.findFirst({
        where: {
          semesterId: data.semesterId,
          status: "ACTIVE",
        },
      });
  
      // Nếu là Mentor, chỉ được tạo topic khi có đợt SubmissionPeriod đang mở
      const isMentor = data.userRole === "mentor";
      const isAdmin = ["academic_officer", "admin", "graduation_thesis_manager"].includes(data.userRole);
  
      if (isMentor && !activeSubmissionPeriod) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Hiện tại không có đợt đề xuất nào đang mở. Vui lòng kiểm tra lại!",
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
      const topicStatus = isAdmin ? "PUBLISHED" : "PENDING";
  
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
  

  async updateTopic(req: Request, res: Response) {
    try {
        const { topicId } = req.params; 
        const {
            nameVi,
            nameEn,
            name,
            description,
            isBusiness,
            businessPartner,
            source,
            subSupervisor,
            subSupervisorEmail,
            groupId,
            groupCode,
            documents
        } = req.body;

        if (!topicId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: TOPIC_MESSAGE.INVALID_REQUEST,
            });
        }

        const userRole = req.user!.role;

        const result = await topicService.updateTopic(
            topicId,
            {
                nameVi,
                nameEn,
                name,
                description,
                isBusiness,
                businessPartner,
                source,
                subSupervisor,
                subSupervisorEmail,
                groupId,
                groupCode,
                updatedBy: req.user!.userId,
                documents,
            },
            userRole
        );

        return res.status(result.status).json(result);
    } catch (error) {
        console.error(error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: TOPIC_MESSAGE.ACTION_FAILED,
        });
    }
}

async getTopicById(req: Request, res: Response) {
  try {
    const { topicId } = req.params;

    if (!topicId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Thiếu ID đề tài.",
      });
    }

    const result = await topicService.getTopicById(topicId);

    return res.status(result.status).json(result);
  } catch (error) {
    console.error(error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Lỗi khi lấy chi tiết đề tài.",
    });
  }
}


async getTopicsBySemester(req: Request, res: Response) {
  try {
    const { semesterId } = req.params;

    if (!semesterId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Thiếu ID học kỳ.",
      });
    }

    const result = await topicService.getTopicsBySemester(semesterId);

    return res.status(result.status).json(result);
  } catch (error) {
    console.error(error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Lỗi khi lấy danh sách đề tài.",
    });
  }
}
}
