import { Request, Response } from "express";
import { Express } from 'express';
import { AuthenticatedRequest } from "../middleware/user.middleware";
import { TopicService } from "../service/topic.service";
import HTTP_STATUS from "../constants/httpStatus";
import { TOPIC_MESSAGE } from "../constants/message";

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
      const { id } = req.params;
      const updateData = req.body;

      const topic = await this.topicService.updateTopic(id, updateData, req.user!.userId);

      res.status(HTTP_STATUS.OK).json({
        message: TOPIC_MESSAGE.TOPIC_UPDATED,
        data: topic
      });
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: (error as Error).message
      });
    }
  }

  // Xóa topic
  async deleteTopic(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      await this.topicService.deleteTopic(id);

      res.status(HTTP_STATUS.OK).json({
        message: TOPIC_MESSAGE.TOPIC_DELETED
      });
    } catch (error) {
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
      const { name, description, semesterId, majorId } = req.body;
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
} 