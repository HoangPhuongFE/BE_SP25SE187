import { PrismaClient } from "@prisma/client";

export interface ICreateTopicSubmissionPeriodDTO {
    semesterId: string;
    round: number;
    startDate: Date;
    endDate: Date;
    description?: string | null;
}

export interface IUpdateTopicSubmissionPeriodDTO {
    round?: number;
    startDate?: Date;
    endDate?: Date;
    status?: string;
    description?: string | null;
}

export interface ITopicSubmissionPeriod {
    id: string;
    semesterId: string;
    round: number;
    startDate: Date;
    endDate: Date;
    status: string;
    description: string | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ITopicSubmissionPeriodResponse extends ITopicSubmissionPeriod {
    semester?: {
        code: string;
        startDate: Date;
        endDate: Date;
    };
}

export interface ITopicSubmissionPeriodService {
    createPeriod(data: ICreateTopicSubmissionPeriodDTO, createdBy: string): Promise<ITopicSubmissionPeriod>;
    updatePeriod(id: string, data: IUpdateTopicSubmissionPeriodDTO): Promise<ITopicSubmissionPeriod>;
    deletePeriod(id: string): Promise<void>;
    getPeriodById(id: string): Promise<ITopicSubmissionPeriodResponse | null>;
    getAllPeriods(semesterId?: string): Promise<ITopicSubmissionPeriodResponse[]>;
    getActivePeriods(semesterId: string): Promise<ITopicSubmissionPeriodResponse[]>;
    checkPeriodOverlap(startDate: Date, endDate: Date, semesterId: string, excludePeriodId?: string): Promise<boolean>;
} 