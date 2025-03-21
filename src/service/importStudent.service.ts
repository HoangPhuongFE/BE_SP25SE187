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
    const seenStudents = new Set();
    const DEFAULT_PASSWORD = '123456';
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    const studentRole = await prisma.role.findUnique({ 
      where: { 
        name: 'student',
        isDeleted: false 
      } 
    });
    if (!studentRole) {
      throw new Error('Vai trò "student" không tồn tại. Vui lòng tạo trước.');
    }

    // Đọc dữ liệu từ file Excel
    for (let i = 2; i <= worksheet.actualRowCount; i++) {
      const row = worksheet.getRow(i);
      const studentCode = extractCellValue(row.getCell(1).value);
      const email = extractCellValue(row.getCell(2).value);
      const profession = extractCellValue(row.getCell(3).value);
      const specialty = extractCellValue(row.getCell(4).value);

      if (!studentCode && !email && !profession && !specialty) continue;

      if (!studentCode || !email || !profession || !specialty) {
        errors.push(`Dòng ${i}: Thiếu MSSV, email, ngành hoặc chuyên ngành.`);
        continue;
      }

      const studentKey = `${studentCode}-${email}`;
      if (seenStudents.has(studentKey)) {
        errors.push(`Dòng ${i}: Trùng MSSV ${studentCode} với email ${email} trong file Excel.`);
        continue;
      }
      seenStudents.add(studentKey);

      dataToImport.push({ studentCode, email, profession, specialty, rowIndex: i });
    }

    if (errors.length > 0) {
      return {
        status: 'error',
        message: 'Dữ liệu có lỗi, vui lòng sửa và thử lại.',
        errors,
      };
    }

    let successCount = 0;
    try {
      for (const { studentCode, email, profession, specialty, rowIndex } of dataToImport) {
        let existingUser = await prisma.user.findUnique({ 
          where: { 
            email,
            isDeleted: false 
          } 
        });
        let existingStudent = await prisma.student.findUnique({ 
          where: { 
            studentCode,
            isDeleted: false 
          } 
        });

        if (!existingUser) {
          // Nếu user chưa tồn tại, tạo mới user
          existingUser = await prisma.user.create({
            data: {
              email,
              username: email.split('@')[0],
              passwordHash: hashedPassword,
              student_code: studentCode,
              profession,
              specialty,
            },
          });
        }

        if (!existingStudent) {
          // Kiểm tra hoặc tạo ngành học (major)
          let major = await prisma.major.findUnique({ 
            where: { 
              name: profession,
              isDeleted: false 
            } 
          });
          if (!major) {
            major = await prisma.major.create({ data: { name: profession } });
          }

          // Kiểm tra hoặc tạo chuyên ngành (specialization)
          let specialization = await prisma.specialization.findFirst({
            where: { 
              name: specialty, 
              majorId: major.id,
              isDeleted: false 
            },
          });
          if (!specialization) {
            specialization = await prisma.specialization.create({
              data: { name: specialty, majorId: major.id },
            });
          }

          // Nếu sinh viên chưa có, tạo mới
          existingStudent = await prisma.student.create({
            data: {
              userId: existingUser.id,
              studentCode,
              majorId: major.id,
              specializationId: specialization?.id || null,
              importSource: 'excelImport',
            },
          });
        }

        // Kiểm tra xem sinh viên đã có trong học kỳ chưa
        const existingSemesterStudent = await prisma.semesterStudent.findUnique({
          where: { 
            semesterId_studentId: { semesterId, studentId: existingStudent.id },
            isDeleted: false 
          },
        });

        if (!existingSemesterStudent) {
          // Nếu chưa có, tạo mới
          await prisma.semesterStudent.create({
            data: { semesterId, studentId: existingStudent.id },
          });
        } else {
          console.log(`Sinh viên ${studentCode} đã tồn tại trong học kỳ ${semesterId}, bỏ qua.`);
        }

        // Kiểm tra và thêm userRole nếu chưa có cho học kỳ mới
        const existingUserRole = await prisma.userRole.findFirst({
          where: {
            userId: existingUser.id,
            roleId: studentRole.id,
            semesterId: semesterId,
            isDeleted: false
          },
        });

        if (!existingUserRole) {
          await prisma.userRole.create({
            data: {
              userId: existingUser.id,
              roleId: studentRole.id,
              semesterId,
              isActive: true,
            },
          });
        } else {
          console.log(`User ${existingUser.id} đã có vai trò "student" trong học kỳ ${semesterId}`);
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
