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
    const dataToImport: { studentCode: string; email: string; status: string; rowIndex: number }[] = [];
    const seenStudents = new Set();

    // Đọc dữ liệu từ file Excel
    worksheet.eachRow({ includeEmpty: false }, (row, rowIndex) => {
      if (rowIndex < 2) return; // Bỏ qua dòng tiêu đề

      const studentCode = extractCellValue(row.getCell(1).value);
      const email = extractCellValue(row.getCell(2).value);
      const status = extractCellValue(row.getCell(3).value);

      // Bỏ qua dòng trống
      if (!studentCode && !email && !status) return;

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

    // Nếu có lỗi, dừng import
    if (errors.length > 0) {
      return {
        status: 'error',
        message: 'Dữ liệu có lỗi, vui lòng sửa và thử lại.',
        errors,
      };
    }

    // Tiến hành import
    let successCount = 0;
    try {
      for (const { studentCode, email, status, rowIndex } of dataToImport) {
        const student = await prisma.student.findUnique({
          where: { studentCode },
        });

        if (!student) {
          errors.push(`Dòng ${rowIndex}: Không tìm thấy sinh viên với MSSV ${studentCode}`);
          continue;
        }

        const isEligible = status.toLowerCase() === 'qualified';

        // Kiểm tra xem sinh viên đã có trong học kỳ chưa
        const existingSemesterStudent = await prisma.semesterStudent.findUnique({
          where: {
            semesterId_studentId: { semesterId, studentId: student.id },
          },
        });

        if (!existingSemesterStudent) {
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
          // Nếu đã có, cập nhật thông tin
          await prisma.semesterStudent.update({
            where: {
              semesterId_studentId: { semesterId, studentId: student.id },
            },
            data: {
              status: existingSemesterStudent.status === 'active' ? 'active' : status.toLowerCase(),
              isEligible,
              qualificationStatus: isEligible ? 'qualified' : 'not qualified',
            },
          });
        }

        successCount++;

        // Kiểm tra xem sinh viên đã có vai trò 'student' trong học kỳ chưa
        const studentRole = await prisma.role.findUnique({ where: { name: 'student' } });

        if (studentRole) {
          const existingUserRole = await prisma.userRole.findFirst({
            where: {
              userId: student.userId!,
              roleId: studentRole.id,
              semesterId,
            },
          });

          if (!existingUserRole) {
            await prisma.userRole.create({
              data: {
                userId: student.userId!,
                roleId: studentRole.id,
                semesterId,
                isActive: true,
              },
            });
          }
        }
        
      }
    } catch (error) {
      console.error(`Lỗi khi xử lý dữ liệu:`, error);
      return {
        status: 'error',
        message: 'Quá trình nhập dữ liệu bị hủy do lỗi.',
        errors: [(error as Error).message],
      };
    }

    // Lưu log import vào database
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
