import { Request, Response } from "express";
import { ReviewCouncilService } from "../service/topicReviewCouncil.service";
import { AuthenticatedRequest } from "../middleware/user.middleware";
import { MESSAGES } from "../constants/message";

export class TopicReviewCouncilController {
  private reviewCouncilService = new ReviewCouncilService();

  /**
   * Tạo hội đồng duyệt đề tài mới
   */
  async createReviewTopicCouncil(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, semesterId, councilType, startDate, endDate, description } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }

      const result = await this.reviewCouncilService.createReviewCouncil({
        name,
        semesterId,
        councilType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        description,
        createdBy: userId,
      });

      return res.status(201).json({
        success: true,
        message: MESSAGES.REVIEW_COUNCIL.CREATED,
        data: result,
      });
    } catch (error) {
      console.error("Error creating review council:", error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message || MESSAGES.GENERAL.SERVER_ERROR,
      });
    }
  }

  /**
   * Thêm thành viên vào hội đồng duyệt đề tài
   */
  async addMembersToReviewCouncil(req: AuthenticatedRequest, res: Response) {
    try {
      const { councilId } = req.params;
      const { memberIds } = req.body;

      const result = await this.reviewCouncilService.addMembersToReviewCouncil(
        councilId,
        memberIds
      );

      return res.status(200).json({
        success: true,
        message: MESSAGES.REVIEW_COUNCIL.MEMBER_ADDED,
        data: result,
      });
    } catch (error) {
      console.error("Error adding members to review council:", error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message || MESSAGES.GENERAL.SERVER_ERROR,
      });
    }
  }

  /**
   * Gán người đánh giá chính cho hội đồng duyệt đề tài
   */
  async assignPrimaryReviewer(req: AuthenticatedRequest, res: Response) {
    try {
      const { councilId } = req.params;
      const { reviewerId } = req.body;

      const result = await this.reviewCouncilService.assignPrimaryReviewer(
        councilId,
        reviewerId
      );

      return res.status(200).json({
        success: true,
        message: MESSAGES.REVIEW_COUNCIL.PRIMARY_REVIEWER_ASSIGNED,
        data: result,
      });
    } catch (error) {
      console.error("Error assigning primary reviewer:", error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message || MESSAGES.GENERAL.SERVER_ERROR,
      });
    }
  }

  /**
   * Import kết quả đánh giá đề tài
   */
  async importTopicEvaluations(req: AuthenticatedRequest, res: Response) {
    try {
      const { councilId } = req.params;
      const { evaluations } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: MESSAGES.USER.UNAUTHORIZED,
        });
      }

      const result = await this.reviewCouncilService.importTopicEvaluations(
        councilId,
        userId,
        evaluations
      );

      return res.status(200).json({
        success: true,
        message: MESSAGES.REVIEW_COUNCIL.EVALUATIONS_IMPORTED,
        data: result,
      });
    } catch (error) {
      console.error("Error importing topic evaluations:", error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message || MESSAGES.GENERAL.SERVER_ERROR,
      });
    }
  }

  /**
   * Lấy danh sách hội đồng duyệt đề tài
   */
  async getReviewCouncils(req: AuthenticatedRequest, res: Response) {
    try {
      const { semesterId, councilType, status, page = 1, pageSize = 10 } = req.query;

      const result = await this.reviewCouncilService.getReviewCouncils({
        semesterId: semesterId as string,
        councilType: councilType as string,
        status: status as string,
        page: Number(page),
        pageSize: Number(pageSize),
      });

      return res.status(200).json({
        success: true,
        message: MESSAGES.REVIEW_COUNCIL.FETCHED,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Error getting review councils:", error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message || MESSAGES.GENERAL.SERVER_ERROR,
      });
    }
  }

  /**
   * Lấy chi tiết hội đồng duyệt đề tài
   */
  async getReviewCouncilDetail(req: AuthenticatedRequest, res: Response) {
    try {
      const { councilId } = req.params;

      const result = await this.reviewCouncilService.getReviewCouncilDetail(councilId);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: MESSAGES.REVIEW_COUNCIL.NOT_FOUND,
        });
      }

      return res.status(200).json({
        success: true,
        message: MESSAGES.REVIEW_COUNCIL.DETAIL_FETCHED,
        data: result,
      });
    } catch (error) {
      console.error("Error getting review council detail:", error);
      return res.status(500).json({
        success: false,
        message: (error as Error).message || MESSAGES.GENERAL.SERVER_ERROR,
      });
    }
  }
} 