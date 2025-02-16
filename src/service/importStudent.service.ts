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

export class ImportStudentService {
  async importExcel(filePath: string, userId: string, semesterId: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('Không tìm thấy worksheet');
    }

    const errors: string[] = [];
    const dataToImport = [];
    const DEFAULT_PASSWORD = '123456';
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    const studentRole = await prisma.role.findUnique({ where: { name: 'student' } });
    if (!studentRole) {
      throw new Error('Vai trò "student" không tồn tại. Vui lòng tạo trước.');
    }

    // **Kiểm tra dữ liệu trước khi import**
    for (let i = 2; i <= worksheet.actualRowCount; i++) {
      const row = worksheet.getRow(i);
      const email = extractCellValue(row.getCell(1).value);
      const profession = extractCellValue(row.getCell(2).value);
      const specialty = extractCellValue(row.getCell(3).value);

      if (!email || !profession || !specialty) {
        errors.push(`Dòng ${i}: Thiếu email, ngành hoặc chuyên ngành.`);
      } else {
        dataToImport.push({ email, profession, specialty, rowIndex: i });
      }
    }

    // **Nếu có lỗi, trả về danh sách lỗi và dừng lại**
    if (errors.length > 0) {
      return {
        status: 'error',
        message: 'Dữ liệu có lỗi, vui lòng sửa và thử lại.',
        errors,
      };
    }

    // **Tiến hành import dữ liệu nếu không có lỗi**
    let successCount = 0;
    for (const { email, profession, specialty, rowIndex } of dataToImport) {
      try {
        let major = await prisma.major.findUnique({ where: { name: profession } });
        if (!major) {
          major = await prisma.major.create({ data: { name: profession } });
        }

        let specialization = await prisma.specialization.findFirst({
          where: { name: specialty, majorId: major.id },
        });
        if (!specialization) {
          specialization = await prisma.specialization.create({
            data: { name: specialty, majorId: major.id },
          });
        }

        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              username: email.split('@')[0],
              passwordHash: hashedPassword,
            },
          });

          await prisma.userRole.create({
            data: {
              userId: user.id,
              roleId: studentRole.id,
              isActive: true,
            },
          });
        }

        let student = await prisma.student.findFirst({
          where: { studentCode: email.split('@')[0] },
        });

        if (!student) {
          student = await prisma.student.create({
            data: {
              userId: user.id,
              majorId: major.id,
              specializationId: specialization?.id || null,
              studentCode: email.split('@')[0],
              importSource: 'excelImport',
            },
          });
        }

        await prisma.semesterStudent.upsert({
          where: {
            semesterId_studentId: {
              semesterId,
              studentId: student.id,
            },
          },
          create: {
            semesterId,
            studentId: student.id,
          },
          update: {},
        });

        successCount++;
      } catch (error) {
        console.error(`Lỗi khi xử lý dòng ${rowIndex}:`, error);
        errors.push(`Dòng ${rowIndex}: Lỗi khi xử lý dữ liệu.`);
      }
    }

    const fileName = filePath.split('/').pop();
    await prisma.importLog.create({
      data: {
        source: 'Nhập danh sách sinh viên',
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
