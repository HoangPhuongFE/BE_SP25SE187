// services/export-topic.service.ts
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import HTTP_STATUS from '../constants/httpStatus';

const prisma = new PrismaClient();

export class ExportTopicService {
  
  async getTopicsForApproval(query: { submissionPeriodId?: string; round?: number; semesterId?: string }) {
    try {
      let submissionPeriodId: string;
      if (query.submissionPeriodId) {
        submissionPeriodId = query.submissionPeriodId;
        const submissionPeriod = await prisma.submissionPeriod.findUnique({ where: { id: submissionPeriodId } });
        if (!submissionPeriod) {
          return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy đợt xét duyệt!' };
        }
      } else if (query.round !== undefined && query.semesterId) {
        const semester = await prisma.semester.findUnique({ where: { id: query.semesterId } });
        if (!semester) {
          return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy học kỳ!' };
        }
        const submissionPeriod = await prisma.submissionPeriod.findFirst({
          where: { semesterId: query.semesterId, roundNumber: query.round },
        });
        if (!submissionPeriod) {
          return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy đợt xét duyệt!' };
        }
        submissionPeriodId = submissionPeriod.id;
      } else {
        return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: 'Thiếu thông tin cần thiết!' };
      }

      const topics = await prisma.topic.findMany({
        where: { submissionPeriodId, status: 'PENDING' },
        include: {
          group: { select: { groupCode: true, id: true } },
          decisions: { select: { draftFileUrl: true, finalFileUrl: true } },
          subMentor: { select: { fullName: true, email: true } },
        },
      });

      if (topics.length === 0) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: 'Không tìm thấy đề tài nào!' };
      }

      return { success: true, status: HTTP_STATUS.OK, data: topics };
    } catch (error) {
      console.error('Error in getTopicsForApproval:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi hệ thống!' };
    }
  }


  async exportTopicsToExcel(topics: any[]) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Topics');

      // Định nghĩa các cột của file Excel
      worksheet.columns = [
        { header: 'Mã đề tài', key: 'topicCode', width: 15 },
        { header: 'Tên đề tài (VN)', key: 'nameVi', width: 30 },
        { header: 'Tên đề tài (EN)', key: 'nameEn', width: 30 },
        { header: 'Tên rút gọn', key: 'name', width: 20 },
        { header: 'Mô tả', key: 'description', width: 50 },
        { header: 'Học kỳ', key: 'semesterId', width: 15 },
        { header: 'Ngành', key: 'majorId', width: 15 },
        { header: 'Kinh doanh', key: 'isBusiness', width: 10 },
        { header: 'Đối tác kinh doanh', key: 'businessPartner', width: 20 },
        { header: 'Nguồn', key: 'source', width: 20 },
        { header: 'Phụ trách phụ', key: 'subSupervisor', width: 20 },
        { header: 'Email phụ trách', key: 'subSupervisorEmail', width: 30 },
        { header: 'Nhóm đề xuất', key: 'proposedGroupId', width: 20 },
        { header: 'File nháp', key: 'draftFileUrl', width: 50 },
        { header: 'File chính', key: 'finalFileUrl', width: 50 },
        { header: 'Lí do', key: 'reviewReason', width: 40 },
        { header: 'Ngày tạo', key: 'createdAt', width: 20 },
      ];

      // Mapping dữ liệu của từng đề tài thành một hàng trong Excel
      topics.forEach(topic => {
        worksheet.addRow({
          topicCode: topic.topicCode,
          nameVi: topic.nameVi,
          nameEn: topic.nameEn,
          name: topic.name,
          description: topic.description,
          semesterId: topic.semesterId,
          majorId: topic.majorId,
          isBusiness: topic.isBusiness ? 'Có' : 'Không',
          businessPartner: topic.businessPartner,
          source: topic.source,
          // Ưu tiên thông tin từ quan hệ subMentor nếu có, nếu không dùng dữ liệu trực tiếp
          subSupervisor: topic.subMentor ? topic.subMentor.fullName : topic.subSupervisor || '',
          subSupervisorEmail: topic.subMentor ? topic.subMentor.email : topic.subSupervisorEmail || '',
          proposedGroupId: topic.proposedGroupId,
          draftFileUrl: topic.decisions && topic.decisions.length > 0 ? topic.decisions[0].draftFileUrl : '',
          finalFileUrl: topic.decisions && topic.decisions.length > 0 ? topic.decisions[0].finalFileUrl || '' : '',
          reviewReason: topic.reviewReason || '',
          createdAt: topic.createdAt ? new Date(topic.createdAt).toLocaleString() : '',
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return { success: true, status: HTTP_STATUS.OK, data: buffer };
    } catch (error) {
      console.error('Lỗi khi xuất Excel:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi hệ thống khi xuất Excel!' };
    }
  }
}
