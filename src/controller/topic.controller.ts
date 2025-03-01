import { Request, Response } from "express";
import { Express } from 'express';
import { AuthenticatedRequest } from "../middleware/user.middleware";
import { TopicService } from "../service/topic.service";
import HTTP_STATUS from "../constants/httpStatus";
import { MESSAGES, TOPIC_MESSAGE } from "../constants/message";
import ExcelJS from 'exceljs';
import { validateExcelImport } from '../utils/excelValidator';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class TopicController {
  private topicService = new TopicService();

  // Tạo topic mới
  async createTopic(req: AuthenticatedRequest, res: Response) {
    try {
      const { 
        topicCode,
        name, 
        description, 
        maxStudents, 
        majors,
        semesterId,
        isBusiness,
        businessPartner,
        topicDocuments 
      } = req.body;
      
      
      // Xử lý documents từ cả req.files (upload trực tiếp) và req.body.topicDocuments
      let documents: Array<{ fileName: string, filePath: string }> = [];
      
      // Nếu có files được upload qua multer
      if (req.files && Array.isArray(req.files)) {
        documents = req.files.map((file: Express.Multer.File) => ({
          fileName: file.originalname,
          filePath: file.path
        }));
      } 
      // Nếu có topicDocuments trong body request
      else if (topicDocuments && Array.isArray(topicDocuments)) {
        documents = topicDocuments.map((doc: any) => ({
          fileName: doc.fileName,
          filePath: doc.filePath || doc.documentUrl // Chấp nhận cả filePath hoặc documentUrl
        }));
      }

      const createdBy = req.user!.userId;

      
      const topic = await this.topicService.createTopic({
        topicCode,
        name,
        description,
        maxStudents,
        majors,
        semesterId,
        createdBy,
        isBusiness,
        businessPartner,
        documents
      });

      
      res.status(HTTP_STATUS.CREATED).json({
        message: TOPIC_MESSAGE.TOPIC_CREATED,
        data: topic
      });
    } catch (error) {
      console.error("Error in createTopic:", error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: (error as Error).message
      });
    }
  }

  // Cập nhật topic
  async updateTopic(req: AuthenticatedRequest, res: Response) {
    try {
      const { topicId } = req.params;
      const { 
        name, 
        description, 
        majorId,
        isBusiness,
        businessPartner,
        documents,
        subSupervisor
      } = req.body;

      // Kiểm tra xem người dùng có quyền cập nhật không
      const userId = req.user!.userId;

      // Validate documents nếu có
      if (documents) {
        if (!Array.isArray(documents)) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            message: 'Documents phải là một mảng các URL'
          });
        }

        for (const doc of documents) {
          if (!doc.documentUrl || !doc.fileName) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
              message: 'Mỗi document phải có documentUrl và fileName'
            });
          }

          try {
            new URL(doc.documentUrl);
          } catch (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
              message: 'DocumentUrl không hợp lệ'
            });
          }
        }
      }

      const topic = await this.topicService.updateTopic(topicId, {
        name,
        description,
        majorId,
        isBusiness,
        businessPartner,
        documents,
        subSupervisor,
        updatedBy: userId
      }, userId);

      res.status(HTTP_STATUS.OK).json({
        message: TOPIC_MESSAGE.TOPIC_UPDATED,
        data: topic
      });
    } catch (error) {
      if (error instanceof Error) {
        switch(error.message) {
          case TOPIC_MESSAGE.TOPIC_NOT_FOUND:
            return res.status(HTTP_STATUS.NOT_FOUND).json({
              message: error.message
            });
          case TOPIC_MESSAGE.MENTOR_MAX_TOPICS_REACHED:
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
              message: error.message
            });
          case TOPIC_MESSAGE.UNAUTHORIZED:
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
              message: error.message
            });
          case 'ID topic không hợp lệ':
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
              message: error.message
            });
          default:
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
              message: error.message
            });
        }
      }
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: 'Lỗi không xác định'
      });
    }
  }

  // Xóa topic
  async deleteTopic(req: AuthenticatedRequest, res: Response) {
    try {
      const { topicId } = req.params;
      const userId = req.user!.userId;

      await this.topicService.deleteTopic(topicId, userId);

      res.status(HTTP_STATUS.OK).json({
        message: TOPIC_MESSAGE.TOPIC_DELETED
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === TOPIC_MESSAGE.TOPIC_NOT_FOUND) {
          return res.status(HTTP_STATUS.NOT_FOUND).json({
            message: error.message
          });
        }
        if (error.message === TOPIC_MESSAGE.INVALID_ID) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            message: error.message
          });
        }
        if (error.message === TOPIC_MESSAGE.TOPIC_IN_USE) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            message: error.message
          });
        }
      }
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: (error as Error).message
      });
    }
  }

  // Duyệt đăng ký topic
  async approveTopicRegistration(req: AuthenticatedRequest, res: Response) {
    try {
      const { registrationId } = req.params;
      const { status, rejectionReason } = req.body;
      const reviewerId = req.user!.userId;

      const documents = Array.isArray(req.files) ? req.files.map((file: Express.Multer.File) => ({
        fileName: file.originalname,
        filePath: file.path
      })) : [];

      const registration = await this.topicService.approveTopicRegistration(
        registrationId,
        {
          status,
          rejectionReason,
          documents: documents.map(doc => ({
            fileName: doc.fileName,
            documentUrl: doc.filePath
          })),
          reviewerId
        }
      );

      res.status(HTTP_STATUS.OK).json({
        message: TOPIC_MESSAGE.TOPIC_REGISTRATION_UPDATED,
        data: registration
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === TOPIC_MESSAGE.TOPIC_REGISTRATION_NOT_FOUND) {
          return res.status(HTTP_STATUS.NOT_FOUND).json({
            message: error.message
          });
        }
      }
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: (error as Error).message
      });
    }
  }

  async registerTopic(req: AuthenticatedRequest, res: Response) {
    try {
      const { 
        name, 
        description, 
        semesterId, 
        majorId,
        isBusiness,
        businessPartner,
        documents,
        subSupervisor
      } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          message: 'Unauthorized'
        });
      }

      // Validate documents nếu có
      if (documents) {
        if (!Array.isArray(documents)) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            message: 'Documents phải là một mảng các URL'
          });
        }

        for (const doc of documents) {
          if (!doc.documentUrl || !doc.fileName) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
              message: 'Mỗi document phải có documentUrl và fileName'
            });
          }

          try {
            new URL(doc.documentUrl);
          } catch (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
              message: 'DocumentUrl không hợp lệ'
            });
          }
        }
      }

      const result = await this.topicService.registerTopic({
        name,
        description,
        userId,
        semesterId,
        majorId,
        isBusiness,
        businessPartner,
        documents,
        subSupervisor
      });

      res.status(HTTP_STATUS.CREATED).json({
        message: TOPIC_MESSAGE.TOPIC_REGISTRATION_CREATED,
        data: {
          topic: {
            id: result.id,
            topicCode: result.topicCode,
            name: result.name,
            description: result.description,
            status: result.status,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
            detailMajorTopics: result.detailMajorTopics,
            creator: result.creator,
            subMentor: result.subMentor
          },
          submissionPeriod: {
            id: result.submissionPeriod.id,
            round: result.submissionPeriod.round,
            startDate: result.submissionPeriod.startDate,
            endDate: result.submissionPeriod.endDate,
            status: result.submissionPeriod.status
          }
        }
      });
    } catch (error) {
      if (error instanceof Error) {
        switch(error.message) {
          case TOPIC_MESSAGE.MENTOR_MAX_TOPICS_REACHED:
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
              message: error.message
            });
          case TOPIC_MESSAGE.UNAUTHORIZED:
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
              message: error.message
            });
          default:
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
              message: error.message
            });
        }
      }
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: 'Lỗi không xác định'
      });
    }
  }

  // Lấy danh sách tất cả topic có phân trang
  async getAllTopics(req: AuthenticatedRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const semesterId = req.query.semesterId as string;
      const majorId = req.query.majorId as string;
      const status = req.query.status as string;
      const isBusiness = req.query.isBusiness === 'true' ? true : req.query.isBusiness === 'false' ? false : undefined;
      const search = req.query.search as string;
      const createdBy = req.query.createdBy as string;
      // Để undefined để lấy tất cả các loại đề tài
      const isOfficial = req.query.isOfficial === 'true' ? true : req.query.isOfficial === 'false' ? false : undefined;
      

      // Thêm validation cho page và pageSize
      if (page < 1 || pageSize < 1) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          message: "Page and pageSize must be greater than 0"
        });
      }

      const result = await this.topicService.getAllTopics({
        page,
        pageSize,
        semesterId,
        majorId,
        status,
        isBusiness,
        search,
        createdBy,
        isOfficial
      });
      

      res.status(HTTP_STATUS.OK).json({
        message: TOPIC_MESSAGE.TOPICS_FETCHED,
        data: result
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("not valid")) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            message: error.message
          });
        }
      }
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: (error as Error).message
      });
    }
  }

  // Lấy danh sách đề tài chính thức (do academic officer tạo)
  async getOfficialTopics(req: AuthenticatedRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const semesterId = req.query.semesterId as string;
      const majorId = req.query.majorId as string;
      const status = req.query.status as string;
      const isBusiness = req.query.isBusiness === 'true';
      const search = req.query.search as string;

      // Thêm validation cho page và pageSize
      if (page < 1 || pageSize < 1) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          message: "Page và pageSize phải lớn hơn 0"
        });
      }

      // Lấy danh sách đề tài chính thức - không qua TopicRegistration
      const result = await this.topicService.getAllTopics({
        page,
        pageSize,
        semesterId,
        majorId,
        status,
        isBusiness,
        search,
        isOfficial: true
      });

      res.status(HTTP_STATUS.OK).json({
        message: "Lấy danh sách đề tài chính thức thành công",
        data: result
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("not valid")) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            message: error.message
          });
        }
      }
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: (error as Error).message
      });
    }
  }

  // Lấy danh sách đề xuất đề tài (do mentor đăng ký)
  async getProposedTopics(req: AuthenticatedRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const semesterId = req.query.semesterId as string;
      const majorId = req.query.majorId as string;
      const status = req.query.status as string;
      const isBusiness = req.query.isBusiness === 'true';
      const search = req.query.search as string;
      const mentorId = req.query.mentorId as string || req.user?.userId;

      // Thêm validation cho page và pageSize
      if (page < 1 || pageSize < 1) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          message: "Page và pageSize phải lớn hơn 0"
        });
      }

      // Lấy danh sách đề tài đề xuất (qua TopicRegistration)
      const result = await this.topicService.getAllTopics({
        page,
        pageSize,
        semesterId,
        majorId,
        status,
        isBusiness,
        search,
        isOfficial: false,
        createdBy: mentorId
      });

      res.status(HTTP_STATUS.OK).json({
        message: "Lấy danh sách đề xuất đề tài thành công",
        data: result
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("not valid")) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            message: error.message
          });
        }
      }
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: (error as Error).message
      });
    }
  }

  // Lấy chi tiết topic
  async getTopicDetail(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const topic = await this.topicService.getTopicDetail(id);

      res.status(HTTP_STATUS.OK).json({
        message: TOPIC_MESSAGE.TOPIC_FETCHED,
        data: topic
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === TOPIC_MESSAGE.TOPIC_NOT_FOUND) {
          return res.status(HTTP_STATUS.NOT_FOUND).json({
            message: error.message
          });
        }
      }
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: (error as Error).message
      });
    }
  }

  // Lấy chi tiết đề tài chính thức
  async getOfficialTopicDetail(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const topic = await this.topicService.getTopicDetail(id, true);

      res.status(HTTP_STATUS.OK).json({
        message: "Lấy chi tiết đề tài chính thức thành công",
        data: topic
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === TOPIC_MESSAGE.TOPIC_NOT_FOUND) {
          return res.status(HTTP_STATUS.NOT_FOUND).json({
            message: "Không tìm thấy đề tài chính thức"
          });
        }
      }
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: (error as Error).message
      });
    }
  }

  // Lấy chi tiết đề xuất đề tài
  async getProposedTopicDetail(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const topic = await this.topicService.getTopicDetail(id, false);

      res.status(HTTP_STATUS.OK).json({
        message: "Lấy chi tiết đề xuất đề tài thành công",
        data: topic
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === TOPIC_MESSAGE.TOPIC_NOT_FOUND) {
          return res.status(HTTP_STATUS.NOT_FOUND).json({
            message: "Không tìm thấy đề xuất đề tài"
          });
        }
      }
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: (error as Error).message
      });
    }
  }

  async exportTopics(req: AuthenticatedRequest, res: Response) {
    try {
      const semesterId = req.query.semesterId as string;
      const majorId = req.query.majorId as string;
      const status = req.query.status as string;
      const isBusiness = req.query.isBusiness === 'true';

      const topics = await this.topicService.getTopicsForExport({
        semesterId,
        majorId,
        status,
        isBusiness
      });

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Topics');

      // Định nghĩa các cột
      worksheet.columns = [
        { header: 'Mã đề tài', key: 'topicCode', width: 15 },
        { header: 'Tên đề tài', key: 'name', width: 40 },
        { header: 'Mô tả', key: 'description', width: 50 },
        { header: 'Ngành', key: 'majors', width: 20 },
        { header: 'Học kỳ', key: 'semester', width: 15 },
        { header: 'Năm học', key: 'year', width: 15 },
        { header: 'Người tạo', key: 'creator', width: 20 },
        { header: 'Trạng thái', key: 'status', width: 15 },
        { header: 'Đề tài doanh nghiệp', key: 'isBusiness', width: 20 },
        { header: 'Doanh nghiệp', key: 'businessPartner', width: 25 },
        { header: 'Ngày tạo', key: 'createdAt', width: 20 }
      ];

      // Style cho header
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      // Thêm dữ liệu
      topics.forEach(topic => {
        worksheet.addRow({
          topicCode: topic.topicCode,
          name: topic.name,
          description: topic.description,
          majors: topic.detailMajorTopics.map(dmt => dmt.major.name).join(', '),
          semester: topic.semester.code,
          year: topic.semester.year.year,
          creator: topic.creator.fullName,
          status: topic.status,
          isBusiness: topic.isBusiness ? 'Có' : 'Không',
          businessPartner: topic.businessPartner || '',
          createdAt: topic.createdAt.toLocaleDateString('vi-VN')
        });
      });

      // Tự động điều chỉnh chiều rộng cột
      worksheet.columns.forEach(column => {
        column.alignment = { vertical: 'middle', wrapText: true };
      });

      // Tạo tên file với timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `topics_export_${timestamp}.xlsx`;

      // Set response headers
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

      // Ghi workbook vào response
      await workbook.xlsx.write(res);
      res.end();

    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: (error as Error).message
      });
    }
  }

  // Cập nhật trạng thái đề tài
  async updateTopicStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { topicId } = req.params;
      const { status } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          message: TOPIC_MESSAGE.UNAUTHORIZED
        });
      }

      if (!status) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          message: TOPIC_MESSAGE.MISSING_STATUS
        });
      }

      const updatedTopic = await this.topicService.updateTopicStatus(topicId, status, userId);

      return res.status(HTTP_STATUS.OK).json({
        message: TOPIC_MESSAGE.UPDATE_STATUS_SUCCESS,
        data: updatedTopic
      });

    } catch (error) {
      console.error("Error updating topic status:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: (error as Error).message
      });
    }
  }

  // Lấy danh sách đề tài theo trạng thái
  async getTopicsByStatus(req: Request, res: Response) {
    try {
      const { status } = req.query;
      const { page = 1, pageSize = 10 } = req.query;

      const topics = await this.topicService.getTopicsByStatus(
        status as string,
        Number(page),
        Number(pageSize)
      );

      return res.status(HTTP_STATUS.OK).json({
        message: TOPIC_MESSAGE.GET_TOPICS_SUCCESS,
        data: topics
      });

    } catch (error) {
      console.error("Error getting topics by status:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: (error as Error).message
      });
    }
  }

  async assignTopicToGroup(req: AuthenticatedRequest, res: Response) {
    try {
      const { topicId, groupId } = req.body;
      const mentorId = req.user!.userId;

      const result = await this.topicService.assignTopicToGroup({
        topicId,
        groupId,
        mentorId
      });

      res.status(200).json({
        message: 'Gán đề tài cho nhóm thành công',
        data: result
      });
    } catch (error) {
      res.status(400).json({
        message: (error as Error).message
      });
    }
  }

  /**
   * Lấy danh sách các đề tài có thể chọn (đã được phê duyệt và chưa được gán cho nhóm nào)
   */
  async getAvailableTopics(req: AuthenticatedRequest, res: Response) {
    try {
      const { semesterId, majorId, page = 1, pageSize = 10, search } = req.query;

      if (!semesterId) {
        return res.status(400).json({
          message: 'Thiếu thông tin học kỳ'
        });
      }

      const result = await this.topicService.getAvailableTopics({
        semesterId: semesterId as string,
        majorId: majorId as string | undefined,
        page: Number(page),
        pageSize: Number(pageSize),
        search: search as string | undefined
      });

      return res.status(200).json({
        message: 'Lấy danh sách đề tài thành công',
        ...result
      });
    } catch (error) {
      console.error('Error in getAvailableTopics controller:', error);
      return res.status(400).json({
        message: (error as Error).message
      });
    }
  }

  /**
   * Cho phép nhóm chọn một đề tài đã được phê duyệt
   */
  async selectTopicForGroup(req: AuthenticatedRequest, res: Response) {
    try {
      const { topicId, groupId } = req.body;
      const userId = req.user!.userId;

      if (!topicId || !groupId) {
        return res.status(400).json({
          message: 'Thiếu thông tin đề tài hoặc nhóm'
        });
      }

      const result = await this.topicService.selectTopicForGroup({
        topicId,
        groupId,
        userId
      });

      return res.status(200).json({
        message: 'Chọn đề tài cho nhóm thành công',
        data: result
      });
    } catch (error) {
      console.error('Error in selectTopicForGroup controller:', error);
      return res.status(400).json({
        message: (error as Error).message
      });
    }
  }
}