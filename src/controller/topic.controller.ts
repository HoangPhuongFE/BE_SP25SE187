import { Request, Response } from "express";
import { Express } from 'express';
import { AuthenticatedRequest } from "../middleware/user.middleware";
import { TopicService } from "../service/topic.service";
import HTTP_STATUS from "../constants/httpStatus";
import { TOPIC_MESSAGE } from "../constants/message";
import ExcelJS from 'exceljs';
import { validateExcelImport } from '../utils/excelValidator';
import fs from 'fs';

export class TopicController {
  private topicService = new TopicService();
//
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
        businessPartner 
      } = req.body;
      
      const documents = Array.isArray(req.files) ? req.files.map((file: Express.Multer.File) => ({
        fileName: file.originalname,
        filePath: file.path
      })) : [];

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
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: (error as Error).message
      });
    }
  }

  // Cập nhật topic
  async updateTopic(req: AuthenticatedRequest, res: Response) {
    try {
      const { topicId } = req.params;
      const updateData = req.body;

      const topic = await this.topicService.updateTopic(topicId, updateData, req.user!.userId);

      res.status(HTTP_STATUS.OK).json({
        message: TOPIC_MESSAGE.TOPIC_UPDATED,
        data: topic
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === TOPIC_MESSAGE.TOPIC_NOT_FOUND) {
          return res.status(HTTP_STATUS.NOT_FOUND).json({
            message: error.message
          });
        }
        if (error.message === 'ID topic không hợp lệ') {
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
          documents,
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
        businessPartner 
      } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          message: 'Unauthorized'
        });
      }

      const documents = Array.isArray(req.files) ? req.files.map((file: Express.Multer.File) => ({
        fileName: file.originalname,
        filePath: file.path
      })) : [];

      const result = await this.topicService.registerTopic({
        name,
        description,
        userId,
        semesterId,
        majorId,
        isBusiness,
        businessPartner,
        documents
      });

      res.status(HTTP_STATUS.CREATED).json({
        message: TOPIC_MESSAGE.TOPIC_REGISTRATION_CREATED,
        data: result
      });
    } catch (error) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: (error as Error).message
      });
    }
  }

  // Lấy danh sách topic có phân trang
  async getAllTopics(req: AuthenticatedRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const semesterId = req.query.semesterId as string;
      const majorId = req.query.majorId as string;
      const status = req.query.status as string;
      const isBusiness = req.query.isBusiness === 'true';
      const search = req.query.search as string;
      const createdBy = req.query.createdBy as string;

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
        createdBy
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

  async createTopicReviewCouncil(req: AuthenticatedRequest, res: Response) {
    try {
      const { registrationId } = req.params;
      const { numberOfMembers, mentorIds } = req.body;
      const reviewerId = req.user!.userId;

      const council = await this.topicService.createTopicReviewCouncil(
        registrationId,
        {
          numberOfMembers,
          mentorIds,
          reviewerId
        }
      );

      res.status(HTTP_STATUS.CREATED).json({
        message: 'Hội đồng duyệt đề tài đã được tạo thành công',
        data: council
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === TOPIC_MESSAGE.TOPIC_REGISTRATION_NOT_FOUND) {
          return res.status(HTTP_STATUS.NOT_FOUND).json({
            message: error.message
          });
        }
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          message: error.message
        });
      }
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: 'Lỗi server'
      });
    }
  }

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

  async importTopicEvaluations(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          message: 'Vui lòng tải lên file Excel'
        });
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(req.file.path);
      const worksheet = workbook.getWorksheet(1);

      if (!worksheet) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          message: 'File Excel không có dữ liệu'
        });
      }

      // Validate cấu trúc file Excel
      const requiredColumns = [
        'Mã đề tài',
        'Trạng thái',
        'Lý do từ chối',
        'Người đánh giá'
      ];

      const validationError = validateExcelImport(worksheet, requiredColumns);
      if (validationError) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          message: validationError
        });
      }

      const results = await this.topicService.importTopicEvaluations(
        worksheet,
        req.user!.userId
      );

      // Xóa file tạm sau khi xử lý
      fs.unlinkSync(req.file.path);

      res.status(HTTP_STATUS.OK).json({
        message: 'Import đánh giá đề tài thành công',
        data: {
          total: results.total,
          success: results.success,
          failed: results.failed,
          errors: results.errors
        }
      });

    } catch (error) {
      // Xóa file tạm nếu có lỗi
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }

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
} 