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

export class ImportLecturerService {
  async importExcel(filePath: string, userId: string, semesterId: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('Không tìm thấy worksheet');
    }

    const errors: string[] = [];
    const dataToImport = [];
    const seenLecturers = new Set();
    const DEFAULT_PASSWORD = '123456';
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    const lecturerRole = await prisma.role.findUnique({ where: { name: 'lecturer' } });
    if (!lecturerRole) {
      throw new Error('Vai trò "lecturer" không tồn tại. Vui lòng tạo trước.');
    }

    // Kiểm tra xem semesterId có tồn tại không
    const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (!semester) {
      throw new Error(`Học kỳ với ID ${semesterId} không tồn tại.`);
    }

    // Đọc dữ liệu từ file Excel
    for (let i = 2; i <= worksheet.actualRowCount; i++) {
      const row = worksheet.getRow(i);
      const lecturerCode = extractCellValue(row.getCell(1).value); // Mã giảng viên
      const email = extractCellValue(row.getCell(2).value); // Email
      const fullName = extractCellValue(row.getCell(3).value); // Họ tên

      // Kiểm tra nếu dòng trống thì bỏ qua
      if (!lecturerCode && !email && !fullName) {
        continue;
      }

      if (!lecturerCode || !email || !fullName) {
        errors.push(`Dòng ${i}: Thiếu mã giảng viên, email hoặc họ tên.`);
        continue;
      }

      const lecturerKey = `${lecturerCode}-${email}`;
      if (seenLecturers.has(lecturerKey)) {
        errors.push(`Dòng ${i}: Trùng mã giảng viên ${lecturerCode} với email ${email} trong file Excel.`);
        continue;
      }
      seenLecturers.add(lecturerKey);

      dataToImport.push({ lecturerCode, email, fullName, rowIndex: i });
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
      for (const { lecturerCode, email, fullName, rowIndex } of dataToImport) {
        let existingUser = await prisma.user.findUnique({ where: { email } });

        if (existingUser && existingUser.lecturerCode !== lecturerCode) {
          errors.push(`Dòng ${rowIndex}: Email ${email} đã được sử dụng cho mã giảng viên khác.`);
          continue;
        }

        // Nếu user chưa tồn tại, tạo mới
        if (!existingUser) {
          existingUser = await prisma.user.create({
            data: {
              email,
              username: email.split('@')[0],
              passwordHash: hashedPassword,
              lecturerCode,
              fullName,
            },
          });
        } else {
          // Nếu user đã tồn tại, cập nhật thông tin nếu cần
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { lecturerCode, fullName },
          });
        }

        // Kiểm tra xem user đã có vai trò "lecturer" trong học kỳ này chưa
        const existingUserRole = await prisma.userRole.findUnique({
          where: {
            userId_roleId_semesterId: {
              userId: existingUser.id,
              roleId: lecturerRole.id,
              semesterId,
            },
          },
        });

        if (!existingUserRole) {
          // Gán vai trò lecturer cho user trong học kỳ này
          await prisma.userRole.create({
            data: {
              userId: existingUser.id,
              roleId: lecturerRole.id,
              semesterId, // Bắt buộc có semesterId
              isActive: true,
            },
          });
        } else {
          console.log(`Giảng viên ${lecturerCode} đã có vai trò lecturer trong học kỳ ${semesterId}, bỏ qua.`);
        }

        successCount++;
      }

      // Lưu log import
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

 

  async getAllLecturers(semesterId: string) {
    try {
      const lecturers = await prisma.user.findMany({
        where: {
          lecturerCode: {
            not: null // Chỉ lấy những user có lecturerCode
          },
          roles: { // Sử dụng 'roles' thay vì 'userRoles'
            some: {
              role: {
                name: 'lecturer'
              },
              semesterId: semesterId
            }
          }
        },
        include: { // Sử dụng include để lấy dữ liệu quan hệ
          roles: {
            where: {
              semesterId: semesterId
            },
            include: {
              role: true,
              semester: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const formattedLecturers = lecturers.map(lecturer => ({
        id: lecturer.id,
        email: lecturer.email,
        username: lecturer.username,
        lecturerCode: lecturer.lecturerCode || '',
        fullName: lecturer.fullName || '',
        isActive: lecturer.roles[0]?.isActive ?? false,
        semesterId: lecturer.roles[0]?.semester?.id,
        semesterCode: lecturer.roles[0]?.semester?.code,
        role: lecturer.roles[0]?.role.name,
        createdAt: lecturer.createdAt,
        updatedAt: lecturer.updatedAt
      }));

      return {
        status: 'success',
        data: formattedLecturers,
        total: formattedLecturers.length
      };
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
          lecturerCode: {
            not: null // Đảm bảo là giảng viên
          },
          roles: {
            some: {
              role: {
                name: 'lecturer'
              },
              semesterId: semesterId
            }
          }
        },
        include: {
          roles: {
            where: {
              semesterId: semesterId
            },
            include: {
              role: true,
              semester: true
            }
          }
        }
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
        isActive: lecturer.roles[0]?.isActive ?? false,
        semesterId: lecturer.roles[0]?.semester?.id,
        semesterName: lecturer.roles[0]?.semester?.code,
        role: lecturer.roles[0]?.role.name,
        createdAt: lecturer.createdAt,
        updatedAt: lecturer.updatedAt
      };

      return {
        status: 'success',
        data: formattedLecturer
      };
    } catch (error) {
      console.error('Error fetching lecturer by ID:', error);
      throw new Error('Không thể lấy thông tin giảng viên');
    }
  }

}
