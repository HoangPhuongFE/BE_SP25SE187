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
      throw new Error('Worksheet is undefined');
    }

    const errors: string[] = [];
    let successCount = 0;
    const DEFAULT_PASSWORD = '123456';
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10); // Sử dụng bcryptjs

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const email = extractCellValue(row.getCell(1).value);
      const profession = extractCellValue(row.getCell(2).value);
      const specialty = extractCellValue(row.getCell(3).value);

      try {
        if (!email) throw new Error('Email không được để trống');
        if (!profession) throw new Error('Ngành (Profession) không được để trống');

        let major = await prisma.major.findUnique({ where: { name: profession } });
        if (!major) {
          major = await prisma.major.create({ data: { name: profession } });
        }

        let specialization = await prisma.specialization.findFirst({
          where: { name: specialty, majorId: major.id },
        });
        if (!specialization && specialty) {
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
       // console.error(`Error processing row ${i}:`, error);
        errors.push(`Dòng ${i}: ${(error as Error).message}`);
      }
    }

    const fileName = filePath.split('/').pop();
    await prisma.importLog.create({
      data: {
        source: 'Excel Import',
        fileName: fileName || 'unknown',
        importById: userId,
        totalRecords: worksheet.rowCount - 1,
        successRecords: successCount,
        errorRecords: errors.length,
        errorsDetails: errors.join('\n'),
      },
    });

    if (errors.length) {
      throw new Error(`Import hoàn thành với lỗi: ${errors.join('\n')}`);
    }
  }
}
