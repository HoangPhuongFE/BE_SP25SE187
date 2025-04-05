import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import HTTP_STATUS from '../constants/httpStatus';
import { MESSAGES } from '../constants/message';
import fs from 'fs';
import { AIService } from '../services/ai.service'; // Giả sử AIService được định nghĩa trong file aiService.ts

const prisma = new PrismaClient();

export class BusinessTopicService {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService(); // Khởi tạo AIService để sử dụng Google Gemini
  }

  // Hàm ghi log hệ thống
  private async logSystemEvent(
    action: string,
    entityType: string,
    entityId: string,
    description: string,
    severity: string,
    metadata: any,
    userId: string,
    ipAddress: string = 'unknown'
  ) {
    await prisma.systemLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        description: description.length > 191 ? description.substring(0, 188) + '...' : description,
        severity,
        metadata,
        ipAddress,
        isDeleted: false,
      },
    });
  }

  async importBusinessTopics(
    file: Express.Multer.File,
    semesterId: string,
    submissionPeriodId: string,
    businessId: string,
    ipAddress: string = 'unknown'
  ) {
    try {
      // **Kiểm tra file**
      if (!file || !file.path) {
        throw new Error('File không hợp lệ hoặc không có đường dẫn.');
      }

      // **Kiểm tra semesterId và submissionPeriodId**
      const semester = await prisma.semester.findUnique({
        where: { id: semesterId, isDeleted: false },
        select: { id: true, status: true, startDate: true, code: true },
      });
      if (!semester || !semester.code) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: MESSAGES.SEMESTER.SEMESTER_NOT_FOUND,
        };
      }

      const submissionPeriod = await prisma.submissionPeriod.findUnique({
        where: { id: submissionPeriodId, isDeleted: false },
        select: { id: true, semesterId: true, status: true },
      });
      if (!submissionPeriod || submissionPeriod.semesterId !== semesterId) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: MESSAGES.TOPIC_SUBMISSION_PERIOD.NOT_FOUND,
        };
      }

      // **Đọc file Excel**
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(file.path);
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: MESSAGES.IMPORT.IMPORT_INVALID_FILE_FORMAT,
        };
      }

      // **Kiểm tra và thu thập dữ liệu từ file Excel**
      const validationResults: any[] = [];
      const topicsToImport: any[] = [];
      let topicCount = await prisma.topic.count({ where: { semesterId } });

      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        if (!row.getCell(1).value) continue; // Bỏ qua hàng trống

        const data = {
          nameVi: row.getCell(1).value?.toString() || '',
          nameEn: row.getCell(2).value?.toString() || '',
          name: row.getCell(3).value?.toString() || '',
          description: row.getCell(4).value?.toString() || '',
          majorNames: row.getCell(5).value?.toString() || '',
          isBusiness: row.getCell(6).value?.toString() === 'Có',
          businessPartner: row.getCell(7).value?.toString() || '',
          source: row.getCell(8).value?.toString() || '',
          semesterId,
          submissionPeriodId,
          createdBy: businessId,
        };

        // **Kiểm tra dữ liệu bắt buộc**
        if (!data.nameVi) {
          validationResults.push({
            row: rowNumber,
            nameVi: data.nameVi,
            status: 'Failed',
            error: MESSAGES.TOPIC.NAME_REQUIRED,
          });
          continue;
        }

        if (!data.description) {
          validationResults.push({
            row: rowNumber,
            nameVi: data.nameVi,
            status: 'Failed',
            error: MESSAGES.TOPIC.DESCRIPTION_REQUIRED,
          });
          continue;
        }

        if (!data.majorNames) {
          validationResults.push({
            row: rowNumber,
            nameVi: data.nameVi,
            status: 'Failed',
            error: MESSAGES.TOPIC.INVALID_MAJOR,
          });
          continue;
        }

        if (!data.businessPartner) {
          validationResults.push({
            row: rowNumber,
            nameVi: data.nameVi,
            status: 'Failed',
            error: MESSAGES.TOPIC.INVALID_BUSINESS_INFO,
          });
          continue;
        }

        // **Kiểm tra tên đề tài bằng AI (Google Gemini)**
        const nameValidation = await this.aiService.validateTopicName(data.nameVi, data.nameEn);
        if (!nameValidation.isValid) {
          validationResults.push({
            row: rowNumber,
            nameVi: data.nameVi,
            status: 'Failed',
            error: nameValidation.message,
          });
          continue;
        }

        // **Tách danh sách ngành và kiểm tra**
        const majorNames = data.majorNames.split(',').map((name: string) => name.trim());
        const majors = await prisma.major.findMany({
          where: { name: { in: majorNames }, isDeleted: false },
        });

        if (majors.length !== majorNames.length) {
          const invalidMajors = majorNames.filter(
            (name: string) => !majors.some((major: any) => major.name === name)
          );
          validationResults.push({
            row: rowNumber,
            nameVi: data.nameVi,
            status: 'Failed',
            error: `${MESSAGES.TOPIC.INVALID_MAJOR}: ${invalidMajors.join(', ')}`,
          });
          continue;
        }

        // **Tạo topicCode**
        const semesterCode = semester.code.toUpperCase();
        const majorCode =
          majors[0].name.length > 1
            ? majors[0].name.split(' ').map((word: string) => word[0].toUpperCase()).join('')
            : majors[0].name.slice(0, 2).toUpperCase();
        topicCount++;
        const topicCode = `${majorCode}-${semesterCode}-${topicCount.toString().padStart(3, '0')}`;

        topicsToImport.push({
          ...data,
          topicCode,
          majors,
          rowNumber,
          nameValidation,
        });
      }

      // **Trả về lỗi nếu validation thất bại**
      if (validationResults.length > 0) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: MESSAGES.IMPORT.IMPORT_PARTIALLY_FAILED,
          data: {
            total: topicsToImport.length + validationResults.length,
            successful: 0,
            failed: validationResults.length,
            details: validationResults,
          },
        };
      }

      // **Nhập đề tài bằng transaction**
      const results: any[] = [];
      let successful = 0;

      for (const topicData of topicsToImport) {
        const { rowNumber, majors, topicCode, nameValidation, ...data } = topicData;

        // Tạo đề tài trong transaction riêng
        const newTopic = await prisma.$transaction(
          async (tx) => {
            const topic = await tx.topic.create({
              data: {
                topicCode,
                nameVi: data.nameVi,
                nameEn: data.nameEn,
                name: data.name,
                description: data.description,
                semesterId: data.semesterId,
                submissionPeriodId: data.submissionPeriodId,
                isBusiness: data.isBusiness,
                businessPartner: data.businessPartner,
                source: data.source,
                createdBy: data.createdBy,
                status: 'APPROVED',
                majors: { connect: majors.map((major: any) => ({ id: major.id })) },
              },
            });
            return topic;
          },
          { timeout: 15000 } // Timeout 15 giây cho mỗi transaction
        );

        // **Ghi log sau khi tạo đề tài thành công**
        await this.logSystemEvent(
          'IMPORT_BUSINESS_TOPIC',
          'topic',
          newTopic.id,
          'Đề tài nhập thành công từ doanh nghiệp',
          'INFO',
          { topicCode, confidence: nameValidation.similarity },
          businessId,
          ipAddress
        );

        results.push({
          row: rowNumber,
          nameVi: data.nameVi,
            nameEn: data.nameEn,
            name: data.name,
            description: data.description,
            majorNames: data.majorNames,
            businessPartner: data.businessPartner,
            source: data.source,
            semesterId: data.semesterId,
            submissionPeriodId: data.submissionPeriodId,
            createdBy: data.createdBy,
            
          topicCode,
          status: 'Imported',
          confidence: nameValidation.similarity,
        });
        successful++;
      }

      // **Phản hồi thành công**
      return {
        success: true,
        status: HTTP_STATUS.OK,
        data: {
          total: results.length,
          successful,
          failed: 0,
          details: results,
        },
      };
    } catch (error) {
      console.error('Lỗi khi nhập đề tài:', error);
      await this.logSystemEvent(
        'IMPORT_BUSINESS_TOPIC_ERROR',
        'topic',
        'N/A',
        'Lỗi khi nhập đề tài từ doanh nghiệp',
        'ERROR',
        { error: (error as Error).message },
        businessId,
        ipAddress
      );
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: (error as Error).message || MESSAGES.GENERAL.SERVER_ERROR,
      };
    }
  }
}