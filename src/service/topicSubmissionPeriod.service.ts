import { PrismaClient, Prisma } from "@prisma/client";
import { MESSAGES } from "../constants/message";
import { BadRequestError, NotFoundError } from "../models/schemas/Error";
import { ICreateTopicSubmissionPeriodDTO, ITopicSubmissionPeriod, ITopicSubmissionPeriodResponse, ITopicSubmissionPeriodService, IUpdateTopicSubmissionPeriodDTO } from "../types/topicSubmissionPeriod";

const prisma = new PrismaClient();

class TopicSubmissionPeriodService implements ITopicSubmissionPeriodService {
    // Hàm kiểm tra và trả về trạng thái dựa trên thời gian
    private getStatusBasedOnTime(startDate: Date, endDate: Date): string {
        const now = new Date();
        if (now < startDate) {
            return MESSAGES.TOPIC_SUBMISSION_PERIOD.STATUS.INACTIVE;
        } else if (now >= startDate && now <= endDate) {
            return MESSAGES.TOPIC_SUBMISSION_PERIOD.STATUS.ACTIVE;
        } else {
            return MESSAGES.TOPIC_SUBMISSION_PERIOD.STATUS.COMPLETED;
        }
    }

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
            
            // Xác định trạng thái dựa trên thời gian
            const status = this.getStatusBasedOnTime(data.startDate, data.endDate);
            
            const period = await prisma.topicSubmissionPeriod.create({
                data: {
                    round: data.round,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    status: status,
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

        const startDate = data.startDate || period.startDate;
        const endDate = data.endDate || period.endDate;

        // Kiểm tra thời gian hợp lệ
        if (startDate >= endDate) {
            throw new BadRequestError(MESSAGES.TOPIC_SUBMISSION_PERIOD.INVALID_DATE_RANGE);
        }

        // Kiểm tra trùng lặp thời gian nếu có thay đổi ngày
        if (data.startDate || data.endDate) {
            const isOverlapped = await this.checkPeriodOverlap(
                startDate,
                endDate,
                period.semesterId,
                id
            );
            if (isOverlapped) {
                throw new BadRequestError(MESSAGES.TOPIC_SUBMISSION_PERIOD.OVERLAPPED_PERIOD);
            }
        }

        // Xác định trạng thái dựa trên thời gian
        const status = this.getStatusBasedOnTime(startDate, endDate);

        const updatedPeriod = await prisma.topicSubmissionPeriod.update({
            where: { id },
            data: {
                round: data.round,
                startDate: data.startDate,
                endDate: data.endDate,
                status: status,
                description: data.description
            }
        });

        return updatedPeriod;
    }

    async deletePeriod(id: string): Promise<void> {
        const period = await prisma.topicSubmissionPeriod.findUnique({
            where: { id },
            include: {
                topicRegistrations: true
            }
        });

        if (!period) {
            throw new NotFoundError(MESSAGES.TOPIC_SUBMISSION_PERIOD.NOT_FOUND);
        }

        if (period.status === MESSAGES.TOPIC_SUBMISSION_PERIOD.STATUS.ACTIVE) {
            throw new BadRequestError(MESSAGES.TOPIC_SUBMISSION_PERIOD.CANNOT_DELETE_ACTIVE);
        }

        // Kiểm tra xem có đăng ký đề tài nào không
        if (period.topicRegistrations.length > 0) {
            throw new BadRequestError(MESSAGES.TOPIC_SUBMISSION_PERIOD.CANNOT_DELETE_HAS_REGISTRATIONS);
        }

        try {
            await prisma.topicSubmissionPeriod.delete({
                where: { id }
            });
        } catch (error: any) {
            console.error('Error deleting topic submission period:', error);
            throw new BadRequestError(`Lỗi khi xóa khoảng thời gian: ${error.message}`);
        }
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