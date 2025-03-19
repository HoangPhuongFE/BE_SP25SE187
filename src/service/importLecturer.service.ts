import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function extractCellValue(cellValue: any): string {
  return typeof cellValue === 'object' && cellValue?.text
    ? cellValue.text
    : String(cellValue || '').trim();
}

export class ImportLecturerService {
  async importExcel(filePath: string, userId: string, semesterId: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) throw new Error('Không tìm thấy worksheet');

    const lecturerRole = await prisma.role.findUnique({ where: { name: 'lecturer' } });
    if (!lecturerRole) throw new Error('Vai trò "lecturer" không tồn tại.');

    const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (!semester) throw new Error(`Học kỳ với ID ${semesterId} không tồn tại.`);

    const errors: string[] = [];
    const dataToImport = [];
    const seenLecturers = new Set();
    const DEFAULT_PASSWORD = 'a123456';
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // Đọc dữ liệu từ Excel
    for (let i = 2; i <= worksheet.actualRowCount; i++) {
      const row = worksheet.getRow(i);
      const lecturerCode = extractCellValue(row.getCell(1).value);
      const email = extractCellValue(row.getCell(2).value);
      const fullName = extractCellValue(row.getCell(3).value);
      const departmentPosition = extractCellValue(row.getCell(4).value); // Chức nhiệm bộ môn
      const department = extractCellValue(row.getCell(5).value); // Bộ phận

      if (!lecturerCode && !email && !fullName) continue;

      if (!lecturerCode || !email || !fullName) {
        errors.push(`Dòng ${i}: Thiếu mã giảng viên, email hoặc họ tên.`);
        continue;
      }

      const lecturerKey = `${lecturerCode}-${email}`;
      if (seenLecturers.has(lecturerKey)) {
        errors.push(`Dòng ${i}: Trùng mã giảng viên ${lecturerCode} với email ${email}.`);
        continue;
      }
      seenLecturers.add(lecturerKey);

      dataToImport.push({ lecturerCode, email, fullName, departmentPosition, department, rowIndex: i });
    }

    if (errors.length > 0) {
      return { status: 'error', message: 'Dữ liệu có lỗi, vui lòng sửa và thử lại.', errors };
    }

    let successCount = 0;
    try {
      for (const { lecturerCode, email, fullName, departmentPosition, department, rowIndex } of dataToImport) {
        let existingUser = await prisma.user.findUnique({ where: { email } });

        if (existingUser && existingUser.lecturerCode !== lecturerCode) {
          errors.push(`Dòng ${rowIndex}: Email ${email} đã được sử dụng cho mã giảng viên khác.`);
          continue;
        }

        if (!existingUser) {
          existingUser = await prisma.user.create({
            data: {
              email,
              username: email.split('@')[0],
              passwordHash: hashedPassword,
              lecturerCode,
              fullName,
              departmentPosition,
              department,
            },
          });
        } else {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { lecturerCode, fullName, departmentPosition, department },
          });
        }

        const existingUserRole = await prisma.userRole.findFirst({
          where: { userId: existingUser.id, roleId: lecturerRole.id, semesterId },
        });

        if (!existingUserRole) {
          await prisma.userRole.create({
            data: { userId: existingUser.id, roleId: lecturerRole.id, semesterId, isActive: true },
          });
        }

        successCount++;
      }

      const fileName = filePath.split('/').pop();
      await prisma.importLog.create({
        data: {
          source: 'Import Lecturer',
          fileName: fileName || 'unknown',
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
    } catch (error) {
      console.error('Lỗi khi xử lý dữ liệu:', error);
      return { status: 'error', message: 'Quá trình nhập dữ liệu bị hủy do lỗi.', errors: [(error as Error).message] };
    }
  }

  async getAllLecturers(semesterId: string) {
    try {
      const lecturers = await prisma.user.findMany({
        where: {
          lecturerCode: { not: null },
          roles: { some: { role: { name: 'lecturer' }, semesterId } },
        },
        include: {
          roles: { where: { semesterId }, include: { role: true, semester: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const formattedLecturers = lecturers.map(lecturer => ({
        id: lecturer.id,
        email: lecturer.email,
        username: lecturer.username,
        lecturerCode: lecturer.lecturerCode || '',
        fullName: lecturer.fullName || '',
        departmentPosition: lecturer.departmentPosition || '',
        department: lecturer.department || '',
        isActive: lecturer.roles[0]?.isActive ?? false,
        semesterId: lecturer.roles[0]?.semester?.id,
        semesterCode: lecturer.roles[0]?.semester?.code,
        role: lecturer.roles[0]?.role.name,
        createdAt: lecturer.createdAt,
        updatedAt: lecturer.updatedAt,
      }));

      return { status: 'success', data: formattedLecturers, total: formattedLecturers.length };
    } catch (error) {
      console.error('Error fetching lecturers:', error);
      throw new Error('Không thể lấy danh sách giảng viên');
    }
  }

  async getLecturerById(userId: string, semesterId: string) {
    try {
      const lecturer = await prisma.user.findUnique({
        where: {
          id: userId,
          lecturerCode: { not: null },
          roles: { some: { role: { name: 'lecturer' }, semesterId } },
        },
        include: {
          roles: { where: { semesterId }, include: { role: true, semester: true } },
        },
      });

      if (!lecturer) {
        throw new Error('Không tìm thấy giảng viên với ID này hoặc không phải giảng viên trong học kỳ được chỉ định');
      }

      const formattedLecturer = {
        id: lecturer.id,
        email: lecturer.email,
        username: lecturer.username,
        lecturerCode: lecturer.lecturerCode || '',
        fullName: lecturer.fullName || '',
        departmentPosition: lecturer.departmentPosition || '',
        department: lecturer.department || '',
        isActive: lecturer.roles[0]?.isActive ?? false,
        semesterId: lecturer.roles[0]?.semester?.id,
        semesterName: lecturer.roles[0]?.semester?.code,
        role: lecturer.roles[0]?.role.name,
        createdAt: lecturer.createdAt,
        updatedAt: lecturer.updatedAt,
      };

      return { status: 'success', data: formattedLecturer };
    } catch (error) {
      console.error('Error fetching lecturer by ID:', error);
      throw new Error('Không thể lấy thông tin giảng viên');
    }
  }
}