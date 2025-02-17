import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function extractCellValue(cellValue: any): string {
  if (typeof cellValue === 'object' && cellValue?.text) {
    return cellValue.text;
  }
  return String(cellValue || '').trim();
}

export class ImportConditionService {
  async importConditionExcel(filePath: string, semesterId: string, userId: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('Không tìm thấy worksheet');
    }

    const errors: string[] = [];
    const dataToImport: { studentCode: string; email: string; status: string; rowIndex: number }[] = [];
    const seenStudents = new Set(); // Kiểm tra trùng MSSV + Email trong file Excel

    // Kiểm tra toàn bộ dữ liệu trước khi import
    worksheet.eachRow({ includeEmpty: false }, (row, rowIndex) => {
      if (rowIndex < 2) return; // Bỏ qua dòng tiêu đề

      const studentCode = extractCellValue(row.getCell(1).value);
      const email = extractCellValue(row.getCell(2).value);
      const status = extractCellValue(row.getCell(3).value);

      // Kiểm tra nếu dòng trống thì bỏ qua
      if (!studentCode && !email && !status) {
        return;
      }

      if (!studentCode || !email || !status) {
        errors.push(`Dòng ${rowIndex}: Thiếu MSSV, email hoặc trạng thái.`);
        return;
      }

      const studentKey = `${studentCode}-${email}`;
      if (seenStudents.has(studentKey)) {
        errors.push(`Dòng ${rowIndex}: Trùng MSSV ${studentCode} với email ${email} trong file Excel.`);
        return;
      }
      seenStudents.add(studentKey);

      dataToImport.push({ studentCode, email, status, rowIndex });
    });

    // Nếu có lỗi, dừng lại và trả về danh sách lỗi ngay lập tức
    if (errors.length > 0) {
      return {
        status: 'error',
        message: 'Dữ liệu có lỗi, vui lòng sửa và thử lại.',
        errors,
      };
    }

    // Tiến hành import nếu không có lỗi
    let successCount = 0;
    try {
      for (const { studentCode, email, status, rowIndex } of dataToImport) {
        const student = await prisma.student.findUnique({
          where: { studentCode },
        });

        if (!student) {
          throw new Error(`Dòng ${rowIndex}: Không tìm thấy sinh viên với MSSV ${studentCode}`);
        }

        const isEligible = status.toLowerCase() === 'qualified';

        // Kiểm tra xem sinh viên đã có trong học kỳ này chưa
        const existingRecord = await prisma.semesterStudent.findUnique({
          where: {
            semesterId_studentId: { semesterId, studentId: student.id },
          },
        });

        if (!existingRecord) {
          // Nếu chưa có, tạo mới
          await prisma.semesterStudent.create({
            data: {
              semesterId,
              studentId: student.id,
              status: status.toLowerCase(),
              isEligible,
              qualificationStatus: isEligible ? 'qualified' : 'not qualified',
            },
          });
        } else {
          // Nếu đã có, chỉ cập nhật nếu cần
          await prisma.semesterStudent.update({
            where: {
              semesterId_studentId: { semesterId, studentId: student.id },
            },
            data: {
              status: existingRecord.status === 'active' ? 'active' : status.toLowerCase(),
              isEligible,
              qualificationStatus: isEligible ? 'qualified' : 'not qualified',
            },
          });
        }

        successCount++;
      }
    } catch (error) {
      console.error(`Lỗi khi xử lý dữ liệu:`, error);
      return {
        status: 'error',
        message: 'Quá trình nhập dữ liệu bị hủy do lỗi.',
        errors: [(error as Error).message],
      };
    }

    const fileName = filePath.split('/').pop();
    await prisma.importLog.create({
      data: {
        source: 'Nhập điều kiện',
        fileName: fileName || 'không xác định',
        importById: userId,
        totalRecords: dataToImport.length,
        successRecords: successCount,
        errorRecords: errors.length,
        errorsDetails: errors.join('\n'),
      },
    });

    return {
      status: 'success',
      message: 'Dữ liệu đã được import thành công.',
      totalRecords: dataToImport.length,
      successRecords: successCount,
      errorRecords: errors.length,
      errors,
    };
  }
}
