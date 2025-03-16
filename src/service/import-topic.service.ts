import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import HTTP_STATUS from '../constants/httpStatus';

const prisma = new PrismaClient();

// Định nghĩa interface cho kết quả kiểm tra dữ liệu
interface ValidationResult {
  valid: boolean;
  data?: {
    topicCode: string;
    nameVi: string;
    nameEn: string;
    name: string;
    description: string;
    semesterId: string;
    isBusiness: boolean;
    businessPartner: string;
    source: string;
    subSupervisorId: string | null;
    proposedGroupId: string | null;
    draftFileUrl: string;
    finalFileUrl: string;
    reviewReason: string;
    createdAt: Date;
    status: string;
    majorId?: string;
  };
  errors?: string[];
}

export class ImportTopicService {
  // Hàm đọc dữ liệu từ file Excel
  async readExcelFile(filePath: string, sheetName: string = 'Topics') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    let worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
      worksheet = workbook.worksheets[0]; // Lấy sheet đầu tiên nếu không tìm thấy sheetName
      if (!worksheet) throw new Error('Không tìm thấy worksheet nào trong file Excel');
    }
    const rows: any[] = [];

    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (rowNumber > 1) { // Bỏ qua hàng tiêu đề
        rows.push({
          topicCode: row.getCell(1).value?.toString(),
          nameVi: row.getCell(2).value?.toString(),
          nameEn: row.getCell(3).value?.toString(),
          name: row.getCell(4).value?.toString(),
          description: row.getCell(5).value?.toString(),
          semesterCode: row.getCell(6).value?.toString(),
          majorName: row.getCell(7).value?.toString(),
          isBusiness: row.getCell(8).value?.toString(),
          businessPartner: row.getCell(9).value?.toString(),
          source: row.getCell(10).value?.toString(),
          subSupervisorEmail: row.getCell(11).value?.toString(),
          groupCode: row.getCell(12).value?.toString(),
          draftFileUrl: row.getCell(13).value?.toString(),
          finalFileUrl: row.getCell(14).value?.toString(),
          reviewReason: row.getCell(15).value?.toString(),
          createdAt: row.getCell(16).value?.toString(),
        });
      }
    });

    return rows;
  }

  // Hàm kiểm tra và chuẩn hóa dữ liệu
  async validateAndNormalizeRow(row: any): Promise<ValidationResult> {
    const errors: string[] = [];

    // Kiểm tra các trường bắt buộc
    if (!row.topicCode) errors.push('Thiếu mã đề tài');
    if (!row.nameVi) errors.push('Thiếu tên đề tài tiếng Việt');
    if (!row.semesterCode) errors.push('Thiếu mã học kỳ');
    if (!row.majorName) errors.push('Thiếu tên chuyên ngành');

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Chuẩn hóa dữ liệu
    const semester = await prisma.semester.findFirst({ where: { code: row.semesterCode } });
    const major = await prisma.major.findFirst({ where: { name: row.majorName } });
    const group = row.groupCode ? await prisma.group.findFirst({ where: { groupCode: row.groupCode } }) : null;
    const subMentor = row.subSupervisorEmail ? await prisma.user.findFirst({ where: { email: row.subSupervisorEmail } }) : null;

    if (!semester) errors.push(`Học kỳ không tồn tại: ${row.semesterCode}`);
    if (!major) errors.push(`Chuyên ngành không tồn tại: ${row.majorName}`);
    if (row.groupCode && !group) errors.push(`Nhóm không tồn tại: ${row.groupCode}`);
    if (row.subSupervisorEmail && !subMentor) errors.push(`Người hướng dẫn phụ không tồn tại: ${row.subSupervisorEmail}`);

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return {
      valid: true,
      data: {
        topicCode: row.topicCode,
        nameVi: row.nameVi,
        nameEn: row.nameEn || '',
        name: row.name || '',
        description: row.description || '',
        semesterId: semester!.id,
        isBusiness: ['Có', 'Yes', 'true'].includes(String(row.isBusiness).toLowerCase()),
        businessPartner: row.businessPartner || '',
        source: row.source || '',
        subSupervisorId: subMentor?.id || null,
        proposedGroupId: group?.id || null,
        draftFileUrl: row.draftFileUrl || '',
        finalFileUrl: row.finalFileUrl || '',
        reviewReason: row.reviewReason || '',
        createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        status: 'PENDING',
        majorId: major!.id,
      },
    };
  }

  // Hàm tạo hoặc cập nhật đề tài
  async importTopic(data: any, createdBy: string) {
    // Upsert đề tài
    const topic = await prisma.topic.upsert({
      where: { topicCode: data.topicCode },
      create: {
        topicCode: data.topicCode,
        nameVi: data.nameVi,
        nameEn: data.nameEn,
        name: data.name,
        description: data.description,
        semesterId: data.semesterId,
        isBusiness: data.isBusiness,
        businessPartner: data.businessPartner,
        source: data.source,
        subSupervisor: data.subSupervisorId,
        proposedGroupId: data.proposedGroupId,
        reviewReason: data.reviewReason,
        createdAt: data.createdAt || new Date(),
        createdBy,
        status: data.status || 'PENDING',
      },
      update: {
        nameVi: data.nameVi,
        nameEn: data.nameEn,
        name: data.name,
        description: data.description,
        semesterId: data.semesterId,
        isBusiness: data.isBusiness,
        businessPartner: data.businessPartner,
        source: data.source,
        ...(data.subSupervisorId && { subSupervisor: data.subSupervisorId }),
        ...(data.proposedGroupId && { proposedGroupId: data.proposedGroupId }),
        reviewReason: data.reviewReason,
        status: data.status,
      },
    });

    // Liên kết với major thông qua bảng trung gian SemesterTopicMajor
    if (data.majorId) {
      await prisma.semesterTopicMajor.create({
        data: {
          semesterId: data.semesterId,
          topicId: topic.id,
          majorId: data.majorId,
          status: 'ACTIVE',
        },
      });
    }

    return topic;
  }

  // Hàm xử lý tài liệu
  async importDocuments(topicId: string, draftFileUrl: string, finalFileUrl: string,fileType: string, uploadedBy: string) {
    if (draftFileUrl) {
      await prisma.document.create({
        data: {
          fileName: 'Tệp nháp',
          fileUrl: draftFileUrl,
          fileType: fileType, // Giả định là PDF
          documentType: 'draft',
          topicId: topicId,
          uploadedBy,
        },
      });
    }
    if (finalFileUrl) {
      await prisma.document.create({
        data: {
          fileName: 'Tệp chính',
          fileUrl: finalFileUrl,
          fileType: fileType, // Giả định là PDF
          documentType: 'final',
          topicId: topicId,
          uploadedBy,
        },
      });
    }
  }

  // Hàm chính để import dữ liệu từ file Excel
  async importTopicsFromExcel(filePath: string, createdBy: string) {
    try {
      const rows = await this.readExcelFile(filePath);
      const results: any[] = [];

      for (const row of rows) {
        const validation = await this.validateAndNormalizeRow(row);
        if (!validation.valid) {
          results.push({ row, success: false, errors: validation.errors });
          continue;
        }

        const data = validation.data!;
        const topic = await this.importTopic(data, createdBy);
        
        if (data.draftFileUrl || data.finalFileUrl) {
          await this.importDocuments(topic.id, data.draftFileUrl, data.finalFileUrl, 'application/pdf', createdBy);
        }

        results.push({ row, success: true, topicId: topic.id });
      }

      return { success: true, status: HTTP_STATUS.OK, data: results };
    } catch (error) {
      console.error('Lỗi khi import dữ liệu:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi hệ thống khi import dữ liệu!' };
    }
  }
}