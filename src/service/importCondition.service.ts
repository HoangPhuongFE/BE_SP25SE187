import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

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
    const dataToImport: { email: string; status: string; rowIndex: number; }[] = [];

    // Kiểm tra toàn bộ dữ liệu trước khi import
    worksheet.eachRow({ includeEmpty: false }, (row, rowIndex) => {
      if (rowIndex < 2) return; // Bỏ qua dòng tiêu đề

      const email = extractCellValue(row.getCell(1).value);
      const status = extractCellValue(row.getCell(2).value);

      if (!email || !status) {
        errors.push(`Dòng ${rowIndex}: Thiếu email hoặc trạng thái.`);
      } else {
        dataToImport.push({ email, status, rowIndex });
      }
    });

    // Nếu có lỗi, dừng lại và trả về danh sách lỗi
    if (errors.length > 0) {
      return {
        status: 'error',
        message: 'Dữ liệu có lỗi, vui lòng sửa và thử lại.',
        errors,
      };
    }

    // Tiến hành import nếu không có lỗi
    let successCount = 0;
    for (const { email, status, rowIndex } of dataToImport) {
      try {
        const student = await prisma.student.findFirst({
          where: { user: { email } },
        });

        if (!student) {
          errors.push(`Dòng ${rowIndex}: Không tìm thấy sinh viên với email ${email}`);
          continue;
        }

        const isEligible = status.toLowerCase() === 'qualified';

        // Upsert dữ liệu vào bảng SemesterStudent
        await prisma.semesterStudent.upsert({
          where: {
            semesterId_studentId: { semesterId, studentId: student.id },
          },
          update: {
            status: status.toLowerCase(),
            isEligible,
            qualificationStatus: isEligible ? 'qualified' : 'not qualified',
          },
          create: {
            semesterId,
            studentId: student.id,
            status: status.toLowerCase(),
            isEligible,
            qualificationStatus: isEligible ? 'qualified' : 'not qualified',
          },
        });

        successCount++;
      } catch (error) {
        console.error(`Lỗi khi xử lý dòng ${rowIndex}:`, error);
        errors.push(`Dòng ${rowIndex}: Lỗi không xác định.`);
      }
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
