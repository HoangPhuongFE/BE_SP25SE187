import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function extractCellValue(cellValue: any): string {
  if (typeof cellValue === 'object' && cellValue?.text) {
    return cellValue.text;
  }
  return String(cellValue || '').trim();
}

export class ImportBlock3Service {
  async importBlock3Excel(filePath: string, semesterId: string, userId: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) throw new Error('Không tìm thấy worksheet');

    const semester = await prisma.semester.findUnique({
      where: { id: semesterId, isDeleted: false },
    });

    if (!semester) {
      await prisma.systemLog.create({
        data: {
          userId,
          action: 'IMPORT_CONDITIONS_ATTEMPT',
          entityType: 'Semester',
          entityId: semesterId,
          description: `Thử nhập điều kiện sinh viên nhưng học kỳ không tồn tại hoặc đã bị xóa mềm`,
          severity: 'WARNING',
          ipAddress: 'unknown',
        },
      });
      throw new Error(`Học kỳ với ID ${semesterId} không tồn tại hoặc đã bị xóa.`);
    }

    const errors: string[] = [];
    const dataToImport: {
      studentCode: string;
      email: string;
      qualificationStatus: string;
      block3: boolean;
      rowIndex: number;
    }[] = [];

    const seenStudents = new Set();

    worksheet.eachRow({ includeEmpty: false }, (row, rowIndex) => {
      if (rowIndex < 2) return;

      const studentCode = extractCellValue(row.getCell(1).value);
      const email = extractCellValue(row.getCell(2).value);
      const qualificationStatus = extractCellValue(row.getCell(3).value).toLowerCase();
      const block3Str = extractCellValue(row.getCell(4).value).toLowerCase();


      if (!studentCode && !email && !qualificationStatus && !block3Str) return;

      if (!studentCode || !email || !qualificationStatus || !block3Str) {
        errors.push(`Dòng ${rowIndex}: Thiếu MSSV, email, trạng thái hoặc block3.`);
        return;
      }

      if (!/^\S+@\S+\.\S+$/.test(email)) {
        errors.push(`Dòng ${rowIndex}: Email ${email} không hợp lệ.`);
        return;
      }

      if (!['qualified', 'not qualified'].includes(qualificationStatus)) {
        errors.push(`Dòng ${rowIndex}: Trạng thái ${qualificationStatus} không hợp lệ.`);
        return;
      }

      if (!['true', 'false', 'yes', 'no'].includes(block3Str)) {
        errors.push(`Dòng ${rowIndex}: Giá trị block3 không hợp lệ.`);
        return;
      }

      const block3 = block3Str === 'true' || block3Str === 'yes';

      const studentKey = `${studentCode}-${email}`;
      if (seenStudents.has(studentKey)) {
        errors.push(`Dòng ${rowIndex}: Trùng MSSV ${studentCode} với email ${email}.`);
        return;
      }
      seenStudents.add(studentKey);

      dataToImport.push({ studentCode, email, qualificationStatus, block3, rowIndex });
    });

    if (errors.length > 0) {
      return {
        status: 'error',
        message: 'Dữ liệu có lỗi, vui lòng sửa và thử lại.',
        errors,
      };
    }

    let successCount = 0;

    try {
      for (const { studentCode, email, qualificationStatus, block3, rowIndex } of dataToImport) {
        try {
          let existingUser = await prisma.user.findUnique({ where: { email } });
          if (!existingUser) {
            errors.push(`Dòng ${rowIndex}: Không tìm thấy người dùng với email ${email}.`);
            continue;
          }

          let existingStudent = await prisma.student.findFirst({ where: { studentCode } });
          if (!existingStudent) {
            errors.push(`Dòng ${rowIndex}: Không tìm thấy sinh viên với MSSV ${studentCode}.`);
            continue;
          }

          if (existingStudent.isDeleted) {
            existingStudent = await prisma.student.update({
              where: { id: existingStudent.id },
              data: { isDeleted: false },
            });
          }

          const isEligible = qualificationStatus === 'qualified';
          let existingSemesterStudent = await prisma.semesterStudent.findUnique({
            where: {
              semesterId_studentId: {
                semesterId,
                studentId: existingStudent.id,
              },
            },
          });

          if (!existingSemesterStudent) {
            await prisma.semesterStudent.create({
              data: {
                semesterId,
                studentId: existingStudent.id,
                status: 'ACTIVE',
                isEligible,
                qualificationStatus,
                block3,
              },
            });
          } else {
           
            await prisma.semesterStudent.update({
              where: { id: existingSemesterStudent.id },
              data: {
                isDeleted: false,
                status: 'ACTIVE',
                isEligible,
                qualificationStatus,
                block3,
              },
            });
          }

          const studentRole = await prisma.role.findUnique({
            where: { name: 'student', isDeleted: false },
          });

          if (studentRole && existingStudent.userId) {
            let existingUserRole = await prisma.userRole.findFirst({
              where: {
                userId: existingStudent.userId,
                roleId: studentRole.id,
                semesterId,
              },
            });

            if (!existingUserRole) {
              await prisma.userRole.create({
                data: {
                  userId: existingStudent.userId,
                  roleId: studentRole.id,
                  semesterId,
                  isActive: true,
                },
              });
            } else if (existingUserRole.isDeleted) {
              await prisma.userRole.update({
                where: { id: existingUserRole.id },
                data: { isDeleted: false, isActive: true },
              });
            }
          }

          successCount++;
        } catch (rowError) {
          errors.push(`Lỗi ở dòng ${rowIndex}: ${(rowError as Error).message}`);
        }
      }
    } catch (error) {
      await prisma.systemLog.create({
        data: {
          userId,
          action: 'IMPORT_CONDITIONS_ERROR',
          entityType: 'Semester',
          entityId: semesterId,
          description: `Lỗi hệ thống khi nhập điều kiện sinh viên`,
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
