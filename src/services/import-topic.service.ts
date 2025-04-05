import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import HTTP_STATUS from '../constants/httpStatus';

const prisma = new PrismaClient();

// Hàm helper để trích xuất giá trị từ cell
function extractCellValue(cellValue: any): string {
  if (typeof cellValue === 'object' && cellValue?.text) {
    return cellValue.text;
  }
  return String(cellValue || '').trim();
}

export class ImportTopicUpdateService {
  /**
   * Import cập nhật trạng thái và reviewReason từ file Excel.
   * File Excel phải có các cột:
   *   - Cột A (cell 1): topicCode (Mã đề tài)
   *   - Cột N (cell 14): status (Trạng thái) – giá trị hợp lệ: APPROVED, REJECTED, IMPROVED
   *   - Cột Q (cell 17): reviewReason (Lí do)
   *   - Cột J (cell 10): updaterEmail (Email của người thực hiện cập nhật)
   * @param filePath Đường dẫn file Excel
   * @param userId ID của user thực hiện import (để lưu vào importLog)
   * @param semesterId ID của học kỳ import (nếu cần cho importLog)
   */
  async importTopicUpdatesFromExcel(filePath: string, userId: string, semesterId: string) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      const worksheet = workbook.getWorksheet(1); // Sử dụng sheet đầu tiên
      if (!worksheet) {
        throw new Error('Không tìm thấy worksheet');
      }
      
      let totalRecords = 0;
      let successCount = 0;
      const errorDetails: { rowNumber: number; error: string }[] = [];
      
      // Duyệt từng dòng (giả sử dòng 1 là header, dữ liệu bắt đầu từ dòng 2)
      for (let rowNumber = 2; rowNumber <= worksheet.actualRowCount; rowNumber++) {
        totalRecords++;
        const row = worksheet.getRow(rowNumber);
        try {
          // Lấy dữ liệu từ các cột:
          // Cột A (cell 1): topicCode
          // Cột N (cell 14): status
          // Cột Q (cell 17): reviewReason
          // Cột J (cell 10): updaterEmail
          const topicCode = extractCellValue(row.getCell(1).value);
          const status = extractCellValue(row.getCell(14).value);
          const reviewReason = extractCellValue(row.getCell(17).value);
          const updaterEmail = extractCellValue(row.getCell(13).value);
          
          // Kiểm tra các trường bắt buộc
          if (!topicCode) {
            throw new Error('Thiếu Mã đề tài.');
          }
          if (!status) {
            throw new Error('Thiếu Trạng thái.');
          }
          if (!updaterEmail) {
            throw new Error('Thiếu Email của người cập nhật.');
          }
          
          const allowedStatuses = ['APPROVED', 'REJECTED', 'IMPROVED'];
          if (!allowedStatuses.includes(status)) {
            throw new Error(`Trạng thái không hợp lệ: ${status}`);
          }
          
          // Tra cứu user theo updaterEmail để lấy user.id
          const updaterUser = await prisma.user.findUnique({
            where: { 
              email: updaterEmail,
              isDeleted: false 
            },
            select: { id: true },
          });
          if (!updaterUser) {
            throw new Error(`Không tìm thấy user với email: ${updaterEmail}`);
          }
          
          // Tra cứu đề tài theo topicCode
          const topic = await prisma.topic.findUnique({
            where: { 
              topicCode,
              isDeleted: false 
            },
          });
          if (!topic) {
            throw new Error(`Không tìm thấy đề tài với Mã đề tài: ${topicCode}`);
          }
          
          // Cập nhật đề tài: cập nhật trạng thái và reviewReason (bất kể trạng thái hiện tại)
          await prisma.topic.update({
            where: { id: topic.id },
            data: { status, reviewReason: reviewReason || null },
          });
          
          // Nếu trạng thái mới là APPROVED và đề tài có proposedGroupId, xử lý nghiệp vụ phụ:
          if (status === 'APPROVED' && topic.proposedGroupId) {
            // Tạo TopicAssignment nếu chưa tồn tại
            const existingAssignment = await prisma.topicAssignment.findFirst({
              where: { 
                topicId: topic.id,
                isDeleted: false 
              },
            });
            if (!existingAssignment) {
              await prisma.topicAssignment.create({
                data: {
                  topicId: topic.id,
                  groupId: topic.proposedGroupId,
                  assignedBy: updaterUser.id,
                  approvalStatus: 'APPROVED',
                  defendStatus: 'NOT_SCHEDULED',
                  status: 'ASSIGNED',
                },
              });
            }
            
            // Cập nhật GroupMentor: gán vai trò mentor_main cho người tạo đề tài
            const mentorMainRole = await prisma.role.findUnique({ 
              where: { 
                name: 'mentor_main',
                isDeleted: false 
              } 
            });
            if (mentorMainRole) {
              await prisma.groupMentor.upsert({
                where: { groupId_mentorId: { groupId: topic.proposedGroupId, mentorId: topic.createdBy } },
                update: {},
                create: {
                  groupId: topic.proposedGroupId,
                  mentorId: topic.createdBy,
                  roleId: mentorMainRole.id,
                  addedBy: updaterUser.id,
                },
              });
            }
            // Nếu đề tài có subSupervisor, tạo record cho mentor_sub
            if (topic.subSupervisor) {
              const mentorSubRole = await prisma.role.findUnique({ 
                where: { 
                  name: 'mentor_sub',
                  isDeleted: false 
                } 
              });
              if (mentorSubRole) {
                await prisma.groupMentor.create({
                  data: {
                    groupId: topic.proposedGroupId,
                    mentorId: topic.subSupervisor,
                    roleId: mentorSubRole.id,
                    addedBy: updaterUser.id,
                  },
                });
              }
            }
            // Reset proposedGroupId của đề tài sau khi xử lý nghiệp vụ phụ
            await prisma.topic.update({
              where: { id: topic.id },
              data: { proposedGroupId: null },
            });
          } else if (status === 'REJECTED' || status === 'IMPROVED') {
            // Với trạng thái REJECTED hoặc IMPROVED, reset proposedGroupId nếu có
            await prisma.topic.update({
              where: { id: topic.id },
              data: { proposedGroupId: null },
            });
          }
          
          successCount++;
        } catch (err: any) {
          errorDetails.push({
            rowNumber,
            error: err.message,
          });
        }
      }
      
      // Sau khi xử lý toàn bộ dòng, lưu log import vào bảng importLog
      const fileName = filePath.split('/').pop();
      await prisma.importLog.create({
        data: {
          source: 'Import Topic Update',
          fileName: fileName || 'unknown',
          importById: userId,
          totalRecords,
          successRecords: successCount,
          errorRecords: errorDetails.length,
          errorsDetails: errorDetails.map(e => `Row ${e.rowNumber}: ${e.error}`).join('\n'),
        },
      });
      
      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: 'Import cập nhật đề tài hoàn tất!',
        data: {
          totalRecords,
          successCount,
          errorCount: errorDetails.length,
          errorDetails,
        },
      };
    } catch (error) {
      console.error('Lỗi khi import cập nhật đề tài:', error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống khi đọc file Excel!',
      };
    }
  }
}
