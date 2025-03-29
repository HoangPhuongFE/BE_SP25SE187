import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function extractCellValue(cellValue: any): string {
  return typeof cellValue === 'object' && cellValue?.text
    ? cellValue.text
    : String(cellValue || '').trim();
}
/*
export class ImportStudentService {
  async importExcel(filePath: string, userId: string, semesterId: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
  
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('Không tìm thấy worksheet');
    }
  
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId, isDeleted: false },
    });
    if (!semester) {
      await prisma.systemLog.create({
        data: {
          userId,
          action: 'IMPORT_STUDENTS_ATTEMPT',
          entityType: 'Semester',
          entityId: semesterId,
          description: `Thử nhập danh sách sinh viên nhưng học kỳ không tồn tại hoặc đã bị xóa mềm`,
          severity: 'WARNING',
          ipAddress: 'unknown',
        },
      });
      throw new Error(`Học kỳ với ID ${semesterId} không tồn tại hoặc đã bị xóa.`);
    }
  
    const errors: string[] = [];
    const dataToImport = [];
    const seenStudents = new Set();
    const DEFAULT_PASSWORD = 'a123456';
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  
    const studentRole = await prisma.role.findUnique({
      where: { name: 'student', isDeleted: false },
    });
    if (!studentRole) {
      throw new Error('Vai trò "student" không tồn tại. Vui lòng tạo trước.');
    }
  
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
  
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        errors.push(`Dòng ${i}: Email ${email} không hợp lệ.`);
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
        try {
          let existingUser = await prisma.user.findUnique({ where: { email } });
          if (existingUser) {
            existingUser = await prisma.user.update({
              where: { id: existingUser.id },
              data: { student_code: studentCode, profession, specialty },
            });
          } else {
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
  
          let existingStudent = await prisma.student.findFirst({ where: { studentCode } });
          if (existingStudent) {
            if (existingStudent.isDeleted) {
              existingStudent = await prisma.student.update({
                where: { id: existingStudent.id },
                data: { isDeleted: false, userId: existingUser.id },
              });
            }
          } else {
            let major = await prisma.major.findUnique({
              where: { name: profession, isDeleted: false },
            });
            if (!major) {
              major = await prisma.major.create({ data: { name: profession } });
            }
  
            let specialization = await prisma.specialization.findFirst({
              where: { name: specialty, majorId: major.id, isDeleted: false },
            });
            if (!specialization) {
              specialization = await prisma.specialization.create({
                data: { name: specialty, majorId: major.id },
              });
            }
  
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
  
          let existingSemesterStudent = await prisma.semesterStudent.findUnique({
            where: { semesterId_studentId: { semesterId, studentId: existingStudent.id } },
          });
          if (!existingSemesterStudent) {
            await prisma.semesterStudent.create({
              data: {
                semesterId,
                studentId: existingStudent.id,
               // status: 'PENDING',
                // Không đặt rõ ràng isEligible và qualificationStatus, để mặc định theo schema
              },
            });
            console.log(`Tạo mới SemesterStudent cho sinh viên ${studentCode} trong học kỳ ${semesterId}`);
          } else if (existingSemesterStudent.isDeleted) {
            await prisma.semesterStudent.update({
              where: { id: existingSemesterStudent.id },
              data: {
                isDeleted: false,
               // status: 'PENDING',
                // Không đặt rõ ràng isEligible và qualificationStatus, để mặc định theo schema
              },
            });
            console.log(`Khôi phục SemesterStudent cho sinh viên ${studentCode} trong học kỳ ${semesterId}`);
          } else {
            console.log(`Sinh viên ${studentCode} đã tồn tại trong học kỳ ${semesterId}, không tạo mới.`);
          }
  
          let existingUserRole = await prisma.userRole.findFirst({
            where: { userId: existingUser.id, roleId: studentRole.id, semesterId },
          });
          if (!existingUserRole) {
            await prisma.userRole.create({
              data: { userId: existingUser.id, roleId: studentRole.id, semesterId, isActive: true },
            });
            console.log(`Tạo mới UserRole cho sinh viên ${studentCode} trong học kỳ ${semesterId}`);
          } else if (existingUserRole.isDeleted) {
            await prisma.userRole.update({
              where: { id: existingUserRole.id },
              data: { isDeleted: false, isActive: true },
            });
            console.log(`Khôi phục UserRole cho sinh viên ${studentCode} trong học kỳ ${semesterId}`);
          } else {
            console.log(`UserRole cho sinh viên ${studentCode} đã tồn tại trong học kỳ ${semesterId}`);
          }
  
          successCount++;
        } catch (rowError) {
          errors.push(`Lỗi ở dòng ${rowIndex}: ${(rowError as Error).message}`);
        }
      }
  
      const fileName = filePath.split('/').pop();
      await prisma.importLog.create({
        data: {
          source: 'Import Student',
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
        message: 'Data imported successfully',
        totalRecords: dataToImport.length,
        successRecords: successCount,
        errorRecords: errors.length,
        errors,
      };
    } catch (error) {
      await prisma.systemLog.create({
        data: {
          userId,
          action: 'IMPORT_STUDENTS_ERROR',
          entityType: 'Semester',
          entityId: semesterId,
          description: `Lỗi hệ thống khi nhập danh sách sinh viên`,
          severity: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
          stackTrace: (error as Error).stack || 'No stack trace',
          ipAddress: 'unknown',
        },
      });
      console.error(`Lỗi khi xử lý dữ liệu:`, error);
      return {
        status: 'error',
        message: 'Quá trình nhập dữ liệu bị hủy do lỗi.',
        errors: [(error as Error).message],
      };
    }
  }
}
  */

export class ImportStudentService {
  async importExcel(filePath: string, userId: string, semesterId: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('Không tìm thấy worksheet');
    }

    const semester = await prisma.semester.findUnique({
      where: { id: semesterId, isDeleted: false },
    });
    if (!semester) {
      await prisma.systemLog.create({
        data: {
          userId,
          action: 'IMPORT_STUDENTS_ATTEMPT',
          entityType: 'Semester',
          entityId: semesterId,
          description: `Thử nhập danh sách sinh viên nhưng học kỳ không tồn tại hoặc đã bị xóa mềm`,
          severity: 'WARNING',
          ipAddress: 'unknown',
        },
      });
      throw new Error(`Học kỳ với ID ${semesterId} không tồn tại hoặc đã bị xóa.`);
    }

    const errors: string[] = [];
    const dataToImport = [];
    const seenStudents = new Set();
    const DEFAULT_PASSWORD = 'a123456';
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    const studentRole = await prisma.role.findUnique({
      where: { name: 'student', isDeleted: false },
    });
    if (!studentRole) {
      throw new Error('Vai trò "student" không tồn tại. Vui lòng tạo trước.');
    }

    // Kiểm tra dữ liệu trước khi import
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

      if (!/^\S+@\S+\.\S+$/.test(email)) {
        errors.push(`Dòng ${i}: Email ${email} không hợp lệ.`);
        continue;
      }

      const studentKey = `${studentCode}-${email}`;
      if (seenStudents.has(studentKey)) {
        errors.push(`Dòng ${i}: Trùng MSSV ${studentCode} với email ${email} trong file Excel.`);
        continue;
      }
      seenStudents.add(studentKey);

      const existingSemesterStudent = await prisma.semesterStudent.findFirst({
        where: {
          student: { studentCode },
          semester: {
            isDeleted: false,
            endDate: { gt: new Date() },
            id: { not: semesterId },
          },
          isDeleted: false,
        },
        include: { semester: true },
      });

      if (existingSemesterStudent) {
        errors.push(`Dòng ${i}: Sinh viên ${studentCode} đã thuộc học kỳ ${existingSemesterStudent.semester.code} chưa kết thúc.`);
        continue;
      }

      dataToImport.push({ studentCode, email, profession, specialty, rowIndex: i });
    }

    // Ghi log và trả về lỗi nếu có
    const fileName = filePath.split('/').pop();
    if (errors.length > 0) {
      await prisma.importLog.create({
        data: {
          source: 'Import Student',
          fileName: fileName || 'unknown',
          importById: userId,
          totalRecords: seenStudents.size,
          successRecords: 0,
          errorRecords: errors.length,
          errorsDetails: errors.join('\n'),
        },
      });
      return {
        status: 'error',
        message: 'Import thất bại do lỗi dữ liệu. Vui lòng sửa và thử lại.',
        totalRecords: seenStudents.size,
        successRecords: 0,
        errorRecords: errors.length,
        errors,
      };
    }

    // Import nếu không có lỗi
    let successCount = 0;
    try {
      for (const { studentCode, email, profession, specialty } of dataToImport) {
        let existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          existingUser = await prisma.user.update({
            where: { id: existingUser.id },
            data: { student_code: studentCode, profession, specialty },
          });
        } else {
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

        let existingStudent = await prisma.student.findFirst({ where: { studentCode } });
        if (existingStudent) {
          if (existingStudent.isDeleted) {
            existingStudent = await prisma.student.update({
              where: { id: existingStudent.id },
              data: { isDeleted: false, userId: existingUser.id },
            });
          }
        } else {
          let major = await prisma.major.findUnique({
            where: { name: profession, isDeleted: false },
          });
          if (!major) {
            major = await prisma.major.create({ data: { name: profession } });
          }

          let specialization = await prisma.specialization.findFirst({
            where: { name: specialty, majorId: major.id, isDeleted: false },
          });
          if (!specialization) {
            specialization = await prisma.specialization.create({
              data: { name: specialty, majorId: major.id },
            });
          }

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

        let existingSemesterStudent = await prisma.semesterStudent.findUnique({
          where: { semesterId_studentId: { semesterId, studentId: existingStudent.id } },
        });
        if (!existingSemesterStudent) {
          await prisma.semesterStudent.create({
            data: {
              semesterId,
              studentId: existingStudent.id,
            },
          });
        } else if (existingSemesterStudent.isDeleted) {
          await prisma.semesterStudent.update({
            where: { id: existingSemesterStudent.id },
            data: { isDeleted: false },
          });
        }

        let existingUserRole = await prisma.userRole.findFirst({
          where: { userId: existingUser.id, roleId: studentRole.id, semesterId },
        });
        if (!existingUserRole) {
          await prisma.userRole.create({
            data: { userId: existingUser.id, roleId: studentRole.id, semesterId, isActive: true },
          });
        } else if (existingUserRole.isDeleted) {
          await prisma.userRole.update({
            where: { id: existingUserRole.id },
            data: { isDeleted: false, isActive: true },
          });
        }

        successCount++;
      }

      await prisma.importLog.create({
        data: {
          source: 'Import Student',
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
        message: 'Data imported successfully',
        totalRecords: dataToImport.length,
        successRecords: successCount,
        errorRecords: errors.length,
        errors,
      };
    } catch (error) {
      await prisma.systemLog.create({
        data: {
          userId,
          action: 'IMPORT_STUDENTS_ERROR',
          entityType: 'Semester',
          entityId: semesterId,
          description: `Lỗi hệ thống khi nhập danh sách sinh viên`,
          severity: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
          stackTrace: (error as Error).stack || 'No stack trace',
          ipAddress: 'unknown',
        },
      });
      throw error; // Ném lỗi để controller xử lý
    }
  }
}