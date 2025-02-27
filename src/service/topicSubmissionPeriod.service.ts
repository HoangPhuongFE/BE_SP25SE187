import { PrismaClient, Prisma } from "@prisma/client";
import { MESSAGES } from "../constants/message";
import { BadRequestError, NotFoundError } from "../models/schemas/Error";
import { ICreateTopicSubmissionPeriodDTO, ITopicSubmissionPeriod, ITopicSubmissionPeriodResponse, ITopicSubmissionPeriodService, IUpdateTopicSubmissionPeriodDTO } from "../types/topicSubmissionPeriod";

const prisma = new PrismaClient();

class TopicSubmissionPeriodService implements ITopicSubmissionPeriodService {
    async createPeriod(data: ICreateTopicSubmissionPeriodDTO, createdBy: string): Promise<ITopicSubmissionPeriod> {
        console.log("Creating period with semesterId:", data.semesterId);
        console.log("Creator ID:", createdBy);
        
        // Kiểm tra học kỳ tồn tại
        const semester = await prisma.semester.findUnique({
            where: { id: data.semesterId }
        });
        console.log("Found semester:", semester);
        
        if (!semester) {
            throw new NotFoundError(MESSAGES.TOPIC_SUBMISSION_PERIOD.INVALID_SEMESTER);
        }

        // Kiểm tra thời gian hợp lệ
        if (data.startDate >= data.endDate) {
            throw new BadRequestError(MESSAGES.TOPIC_SUBMISSION_PERIOD.INVALID_DATE_RANGE);
        }

        // Kiểm tra trùng lặp thời gian
        const isOverlapped = await this.checkPeriodOverlap(data.startDate, data.endDate, data.semesterId);
        if (isOverlapped) {
            throw new BadRequestError(MESSAGES.TOPIC_SUBMISSION_PERIOD.OVERLAPPED_PERIOD);
        }

        try {
            // Kiểm tra người tạo
            const user = await prisma.user.findUnique({
                where: { id: createdBy }
            });
            console.log("Found user:", user);
            
            if (!user) {
                throw new NotFoundError("Không tìm thấy người dùng với ID " + createdBy);
            }
            
            const period = await prisma.topicSubmissionPeriod.create({
                data: {
                    round: data.round,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    status: 'ACTIVE',
                    description: data.description,
                    semester: {
                        connect: { id: data.semesterId }
                    },
                    creator: {
                        connect: { id: createdBy }
                    }
                }
            });

            return period;
        } catch (error: any) {
            console.error('Error creating topic submission period:', error);
            
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2025') {
                    throw new NotFoundError("Không tìm thấy học kỳ hoặc người dùng");
                } else if (error.code === 'P2002') {
                    throw new BadRequestError("Đã tồn tại khoảng thời gian với round này");
                }
            }
            
            throw new BadRequestError(`Lỗi khi tạo khoảng thời gian: ${error.message}`);
        }
    }

    async updatePeriod(id: string, data: IUpdateTopicSubmissionPeriodDTO): Promise<ITopicSubmissionPeriod> {
        const period = await prisma.topicSubmissionPeriod.findUnique({
            where: { id }
        });

        if (!period) {
            throw new NotFoundError(MESSAGES.TOPIC_SUBMISSION_PERIOD.NOT_FOUND);
        }

        if (period.status === MESSAGES.TOPIC_SUBMISSION_PERIOD.STATUS.COMPLETED) {
            throw new BadRequestError(MESSAGES.TOPIC_SUBMISSION_PERIOD.CANNOT_UPDATE_COMPLETED);
        }

        if (data.startDate && data.endDate) {
            // Kiểm tra thời gian hợp lệ
            if (data.startDate >= data.endDate) {
                throw new BadRequestError(MESSAGES.TOPIC_SUBMISSION_PERIOD.INVALID_DATE_RANGE);
            }

            // Kiểm tra trùng lặp thời gian
            const isOverlapped = await this.checkPeriodOverlap(
                data.startDate, 
                data.endDate, 
                period.semesterId,
                id
            );
            if (isOverlapped) {
                throw new BadRequestError(MESSAGES.TOPIC_SUBMISSION_PERIOD.OVERLAPPED_PERIOD);
            }
        }

        const updatedPeriod = await prisma.topicSubmissionPeriod.update({
            where: { id },
            data: {
                round: data.round,
                startDate: data.startDate,
                endDate: data.endDate,
                status: data.status,
                description: data.description
            }
        });

        return updatedPeriod;
    }

    async deletePeriod(id: string): Promise<void> {
        const period = await prisma.topicSubmissionPeriod.findUnique({
            where: { id }
        });

        if (!period) {
            throw new NotFoundError(MESSAGES.TOPIC_SUBMISSION_PERIOD.NOT_FOUND);
        }

        if (period.status === MESSAGES.TOPIC_SUBMISSION_PERIOD.STATUS.ACTIVE) {
            throw new BadRequestError(MESSAGES.TOPIC_SUBMISSION_PERIOD.CANNOT_DELETE_ACTIVE);
        }

        await prisma.topicSubmissionPeriod.delete({
            where: { id }
        });
    }

    async getPeriodById(id: string): Promise<ITopicSubmissionPeriodResponse | null> {
        const period = await prisma.topicSubmissionPeriod.findUnique({
            where: { id },
            include: {
                semester: {
                    select: {
                        code: true,
                        startDate: true,
                        endDate: true
                    }
                }
            }
        });

        if (!period) return null;

        return {
            ...period,
            semester: period.semester ? {
                code: period.semester.code,
                startDate: period.semester.startDate,
                endDate: period.semester.endDate
            } : undefined
        };
    }

    async getAllPeriods(semesterId?: string): Promise<ITopicSubmissionPeriodResponse[]> {
        const periods = await prisma.topicSubmissionPeriod.findMany({
            where: semesterId ? { semesterId } : undefined,
            include: {
                semester: {
                    select: {
                        code: true,
                        startDate: true,
                        endDate: true
                    }
                }
            },
            orderBy: [
                { semesterId: 'desc' },
                { round: 'asc' }
            ]
        });

        return periods.map((period) => ({
            ...period,
            semester: period.semester ? {
                code: period.semester.code,
                startDate: period.semester.startDate,
                endDate: period.semester.endDate
            } : undefined
        }));
    }

    async getActivePeriods(semesterId: string): Promise<ITopicSubmissionPeriodResponse[]> {
        const periods = await prisma.topicSubmissionPeriod.findMany({
            where: {
                semesterId,
                status: MESSAGES.TOPIC_SUBMISSION_PERIOD.STATUS.ACTIVE
            },
            include: {
                semester: {
                    select: {
                        code: true,
                        startDate: true,
                        endDate: true
                    }
                }
            },
            orderBy: { round: 'asc' }
        });

        return periods.map((period) => ({
            ...period,
            semester: period.semester ? {
                code: period.semester.code,
                startDate: period.semester.startDate,
                endDate: period.semester.endDate
            } : undefined
        }));
    }

    async checkPeriodOverlap(
        startDate: Date,
        endDate: Date,
        semesterId: string,
        excludePeriodId?: string
    ): Promise<boolean> {
        const overlappingPeriods = await prisma.topicSubmissionPeriod.count({
            where: {
                semesterId,
                id: { not: excludePeriodId },
                OR: [
                    {
                        startDate: { lte: startDate },
                        endDate: { gte: startDate }
                    },
                    {
                        startDate: { lte: endDate },
                        endDate: { gte: endDate }
                    }
                ]
            }
        });

        return overlappingPeriods > 0;
    }
}

export default new TopicSubmissionPeriodService(); 