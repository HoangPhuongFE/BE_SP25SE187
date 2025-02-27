import { Request, Response } from 'express';
import { MESSAGES } from '../constants/message';
import TopicSubmissionPeriodService from '../service/topicSubmissionPeriod.service';
import { ICreateTopicSubmissionPeriodDTO, IUpdateTopicSubmissionPeriodDTO } from '../types/topicSubmissionPeriod';
import { CustomError } from '../models/schemas/Error';

class TopicSubmissionPeriodController {
    async createPeriod(req: Request, res: Response) {
        try {
            const data: ICreateTopicSubmissionPeriodDTO = {
                ...req.body,
                startDate: new Date(req.body.startDate),
                endDate: new Date(req.body.endDate)
            };
            const createdBy = req.user?.id;
            const period = await TopicSubmissionPeriodService.createPeriod(data, createdBy);
            res.status(201).json({
                message: MESSAGES.TOPIC_SUBMISSION_PERIOD.CREATED,
                data: period
            });
        } catch (error: unknown) {
            const customError = error as CustomError;
            res.status(customError.statusCode || 500).json({
                message: customError.message || MESSAGES.GENERAL.SERVER_ERROR
            });
        }
    }

    async updatePeriod(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const data: IUpdateTopicSubmissionPeriodDTO = {
                ...req.body,
                startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
                endDate: req.body.endDate ? new Date(req.body.endDate) : undefined
            };
            const period = await TopicSubmissionPeriodService.updatePeriod(id, data);
            res.json({
                message: MESSAGES.TOPIC_SUBMISSION_PERIOD.UPDATED,
                data: period
            });
        } catch (error: unknown) {
            const customError = error as CustomError;
            res.status(customError.statusCode || 500).json({
                message: customError.message || MESSAGES.GENERAL.SERVER_ERROR
            });
        }
    }

    async deletePeriod(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await TopicSubmissionPeriodService.deletePeriod(id);
            res.json({
                message: MESSAGES.TOPIC_SUBMISSION_PERIOD.DELETED
            });
        } catch (error: unknown) {
            const customError = error as CustomError;
            res.status(customError.statusCode || 500).json({
                message: customError.message || MESSAGES.GENERAL.SERVER_ERROR
            });
        }
    }

    async getPeriodById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const period = await TopicSubmissionPeriodService.getPeriodById(id);
            if (!period) {
                return res.status(404).json({
                    message: MESSAGES.TOPIC_SUBMISSION_PERIOD.NOT_FOUND
                });
            }
            res.json({
                data: period
            });
        } catch (error: unknown) {
            const customError = error as CustomError;
            res.status(customError.statusCode || 500).json({
                message: customError.message || MESSAGES.GENERAL.SERVER_ERROR
            });
        }
    }

    async getAllPeriods(req: Request, res: Response) {
        try {
            const { semesterId } = req.query;
            const periods = await TopicSubmissionPeriodService.getAllPeriods(semesterId as string);
            res.json({
                message: MESSAGES.TOPIC_SUBMISSION_PERIOD.FETCHED,
                data: periods
            });
        } catch (error: unknown) {
            const customError = error as CustomError;
            res.status(customError.statusCode || 500).json({
                message: customError.message || MESSAGES.GENERAL.SERVER_ERROR
            });
        }
    }

    async getActivePeriods(req: Request, res: Response) {
        try {
            const { semesterId } = req.params;
            const periods = await TopicSubmissionPeriodService.getActivePeriods(semesterId);
            res.json({
                message: MESSAGES.TOPIC_SUBMISSION_PERIOD.FETCHED,
                data: periods
            });
        } catch (error: unknown) {
            const customError = error as CustomError;
            res.status(customError.statusCode || 500).json({
                message: customError.message || MESSAGES.GENERAL.SERVER_ERROR
            });
        }
    }
}

export default new TopicSubmissionPeriodController(); 