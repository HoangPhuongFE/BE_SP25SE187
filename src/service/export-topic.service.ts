// services/export-topic.service.ts
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import HTTP_STATUS from '../constants/httpStatus';

const prisma = new PrismaClient();

export class ExportTopicService {
  
  async getTopicsForApproval(query: { submissionPeriodId?: string; round?: number; semesterId?: string }) {
    try {
      let submissionPeriodId: string;
  
      // Xác định submissionPeriodId từ query
      if (query.submissionPeriodId) {
        submissionPeriodId = query.submissionPeriodId;
        const submissionPeriod = await prisma.submissionPeriod.findUnique({ where: { id: submissionPeriodId } });
        if (!submissionPeriod) {
          return { success: false, status: 404, message: 'Không tìm thấy đợt xét duyệt!' };
        }
      } else if (query.round !== undefined && query.semesterId) {
        const semester = await prisma.semester.findUnique({ where: { id: query.semesterId } });
        if (!semester) {
          return { success: false, status: 404, message: 'Không tìm thấy học kỳ!' };
        }
        const submissionPeriod = await prisma.submissionPeriod.findFirst({
          where: { semesterId: query.semesterId, roundNumber: query.round },
        });
        if (!submissionPeriod) {
          return { success: false, status: 404, message: 'Không tìm thấy đợt xét duyệt!' };
        }
        submissionPeriodId = submissionPeriod.id;
      } else {
        return { success: false, status: 400, message: 'Thiếu thông tin cần thiết!' };
      }
  
      // Truy vấn danh sách đề tài với tên học kỳ và chuyên ngành
      const topics = await prisma.topic.findMany({
        where: { submissionPeriodId, status: 'PENDING' },
        include: {
          group: { select: { groupCode: true } },
          documents: { where: { documentType: { in: ['draft', 'final'] } }, select: { fileUrl: true, documentType: true } },
          subMentor: { select: { fullName: true, email: true } },
          semester: { select: { code: true } }, // Lấy mã học kỳ (name)
          majors: { select: { name: true } },    // Lấy tên chuyên ngành
        },
      });
  
      if (topics.length === 0) {
        return { success: false, status: 404, message: 'Không tìm thấy đề tài nào!' };
      }
  
      return { success: true, status: 200, data: topics };
    } catch (error) {
      console.error('Error in getTopicsForApproval:', error);
      return { success: false, status: 500, message: 'Lỗi hệ thống!' };
    }
  }
  async exportTopicsToExcel(topics: any[]) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Topics');
  
      // Định nghĩa các cột trong file Excel
      worksheet.columns = [
        { header: 'Mã đề tài', key: 'topicCode', width: 15 },
        { header: 'Tên đề tài (VN)', key: 'nameVi', width: 30 },
        { header: 'Tên đề tài (EN)', key: 'nameEn', width: 30 },
        { header: 'Tên rút gọn', key: 'name', width: 20 },
        { header: 'Mô tả', key: 'description', width: 50 },
        { header: 'Học kỳ', key: 'semesterCode', width: 15 }, // Hiển thị mã học kỳ
        { header: 'Ngành', key: 'majorName', width: 15 },     // Hiển thị tên chuyên ngành
        { header: 'Kinh doanh', key: 'isBusiness', width: 10 },
        { header: 'Đối tác kinh doanh', key: 'businessPartner', width: 20 },
        { header: 'Nguồn', key: 'source', width: 20 },
        { header: 'Email phụ trách', key: 'subSupervisorEmail', width: 30 },
        { header: 'Mã nhóm', key: 'groupCode', width: 15 },
        { header: 'File nháp', key: 'draftFileUrl', width: 50 },
        { header: 'File chính', key: 'finalFileUrl', width: 50 },
        { header: 'Lí do', key: 'reviewReason', width: 40 },
        { header: 'Ngày tạo', key: 'createdAt', width: 20 },
      ];
  
      // Ánh xạ dữ liệu từ topics vào các hàng
      topics.forEach(topic => {
        worksheet.addRow({
          topicCode: topic.topicCode,
          nameVi: topic.nameVi,
          nameEn: topic.nameEn,
          name: topic.name,
          description: topic.description,
          semesterCode: topic.semester ? topic.semester.code : '', // Hiển thị mã học kỳ
          majorName: topic.major ? topic.major.name : '',         // Hiển thị tên chuyên ngành
          isBusiness: topic.isBusiness ? 'Có' : 'Không',
          businessPartner: topic.businessPartner,
          source: topic.source,
          subSupervisorEmail: topic.subMentor ? topic.subMentor.email : topic.subSupervisorEmail || '',
          groupCode: topic.group ? topic.group.groupCode : '',
          draftFileUrl: topic.documents.find((doc: { documentType: string; }) => doc.documentType === 'draft')?.fileUrl || '',
          finalFileUrl: topic.documents.find((doc: { documentType: string; }) => doc.documentType === 'final')?.fileUrl || '',
          reviewReason: topic.reviewReason || '',
          createdAt: topic.createdAt ? new Date(topic.createdAt).toLocaleString() : '',
        });
      });
  
      // Xuất file Excel dưới dạng buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return { success: true, status: 200, data: buffer };
    } catch (error) {
      console.error('Lỗi khi xuất Excel:', error);
      return { success: false, status: 500, message: 'Lỗi hệ thống khi xuất Excel!' };
    }
  }
}
