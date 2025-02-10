import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/user.middleware";
import { TopicService } from "../service/topic.service";
import HTTP_STATUS from "../constants/httpStatus";
import { TOPIC_MESSAGE } from "../constants/message";

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
        businessPartner 
      } = req.body;
      
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
        businessPartner
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

      const topic = await this.topicService.updateTopic(id, updateData);

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
      const { status, reviewerId } = req.body;

      const registration = await this.topicService.updateTopicRegistration(
        registrationId,
        status,
        reviewerId
      );

      res.status(HTTP_STATUS.OK).json({
        message: TOPIC_MESSAGE.TOPIC_REGISTRATION_UPDATED,
        data: registration
      });
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: (error as Error).message
      });
    }
  }

  async registerTopic(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, description, semesterId, majorId } = req.body;
      const userId = req.user!.userId;

      const registration = await this.topicService.registerTopic({
        name,
        description,
        userId,
        semesterId,
        majorId
      });

      res.status(HTTP_STATUS.CREATED).json({
        message: TOPIC_MESSAGE.TOPIC_REGISTRATION_CREATED,
        data: registration
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

      const result = await this.topicService.getAllTopics({
        page,
        pageSize,
        semesterId,
        majorId
      });

      res.status(HTTP_STATUS.OK).json({
        message: TOPIC_MESSAGE.TOPICS_FETCHED,
        data: result
      });
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: (error as Error).message
      });
    }
  }
} 