// services/import-topic.service.ts
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import HTTP_STATUS from '../constants/httpStatus';

const prisma = new PrismaClient();

export class ImportTopicService {
  /**
   * Đọc file Excel và chuyển đổi thành mảng dữ liệu đề tài.
   * Giả sử file Excel có worksheet tên là "Topics" và các cột được sắp xếp theo thứ tự:
   * 1. Mã đề tài, 2. Tên đề tài (VN), 3. Tên đề tài (EN), 4. Tên rút gọn,
   * 5. Mô tả, 6. Học kỳ, 7. Ngành, 8. Kinh doanh, 9. Đối tác kinh doanh,
   * 10. Nguồn, 11. Phụ trách phụ, 12. Email phụ trách, 13. Nhóm đề xuất,
   * 14. File nháp, 15. File chính, 16. Lí do, 17. Ngày tạo.
   */
  async parseExcelFile(filePath: string): Promise<any[]> {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.getWorksheet('Topics');
      if (!worksheet) {
        throw new Error("Không tìm thấy worksheet 'Topics'");
      }
      const topicsData: any[] = [];
      worksheet.eachRow((row, rowNumber) => {
        // Bỏ qua hàng header (rowNumber = 1)
        if (rowNumber === 1) return;
        const rowValues = row.values as any[];
        // Các chỉ số bắt đầu từ 1 theo ExcelJS
        const topic = {
          topicCode: rowValues[1],
          nameVi: rowValues[2],
          nameEn: rowValues[3],
          name: rowValues[4],
          description: rowValues[5],
          semesterId: rowValues[6],
          majorId: rowValues[7],
          isBusiness: rowValues[8] === 'Có' ? true : false,
          businessPartner: rowValues[9],
          source: rowValues[10],
          subSupervisor: rowValues[11],
          subSupervisorEmail: rowValues[12],
          proposedGroupId: rowValues[13],
          draftFileUrl: rowValues[14],
          finalFileUrl: rowValues[15],
          reviewReason: rowValues[16],
          createdAt: rowValues[17] ? new Date(rowValues[17]) : new Date(),
        };
        topicsData.push(topic);
      });
      return topicsData;
    } catch (error) {
      console.error('Lỗi khi đọc file Excel:', error);
      throw error;
    }
  }

  
  async importTopicsFromExcel(filePath: string, createdBy: string): Promise<{ success: boolean; status: number; message: string; data?: any }> {
    try {
      const topicsData = await this.parseExcelFile(filePath);
      const importedTopics = [];

      for (const data of topicsData) {
        try {
          // Kiểm tra bắt buộc: semesterId, majorId, nameVi, nameEn,... (theo nghiệp vụ của bạn)
          if (!data.semesterId || !data.majorId || !data.nameVi || !data.nameEn || !data.name) {
            // Bỏ qua hoặc ghi log nếu dữ liệu không đầy đủ.
            console.warn('Dữ liệu không đầy đủ:', data);
            continue;
          }

          // Ví dụ: tạo topic với các trường cơ bản (lưu ý: các trường như submissionPeriodId, status sẽ được thiết lập mặc định)
          const newTopic = await prisma.topic.create({
            data: {
              topicCode: data.topicCode, // Nếu topicCode đã tồn tại, sẽ báo lỗi; bạn có thể thêm logic kiểm tra trùng lặp.
              nameVi: data.nameVi,
              nameEn: data.nameEn,
              name: data.name,
              description: data.description,
              semesterId: data.semesterId,
              isBusiness: data.isBusiness,
              businessPartner: data.businessPartner,
              source: data.source,
              subSupervisor: data.subSupervisor,
              createdBy: createdBy, // Lấy từ người import
              status: 'PENDING', // Hoặc tùy nghiệp vụ
              // Bạn có thể bổ sung thêm các trường khác nếu cần
              // Nếu muốn lưu submissionPeriodId thì cần xác định logic của bạn.
            },
          });

          // Nếu dữ liệu file từ Excel có chứa thông tin Decision, tạo luôn Decision cho topic này.
          if (data.draftFileUrl || data.finalFileUrl) {
            await prisma.decision.create({
              data: {
                decisionNumber: data.topicCode
                  ? `QD-DRAFT-${new Date().getFullYear()}-${data.topicCode}`
                  : `QD-DRAFT-${new Date().getFullYear()}-${Math.random().toString(36).substr(2, 4)}`,
                decisionTitle: `Đề xuất đề tài ${newTopic.topicCode}`,
                topicId: newTopic.id,
                draftFileUrl: data.draftFileUrl || null,
                finalFileUrl: data.finalFileUrl || null,
                status: 'PENDING',
                createdBy: createdBy,
                // Nếu đề tài có group đề xuất, bạn có thể thêm logic ở đây
              },
            });
          }
          importedTopics.push(newTopic);
        } catch (innerError) {
          console.error('Lỗi khi tạo đề tài:', innerError);
          // Bạn có thể lưu lại thông tin lỗi hoặc tiếp tục với bản ghi khác
        }
      }
      return { success: true, status: HTTP_STATUS.OK, message: 'Nhập đề tài thành công!', data: importedTopics };
    } catch (error) {
      console.error('Lỗi khi import Excel:', error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: 'Lỗi hệ thống khi import Excel!' };
    }
  }
}
