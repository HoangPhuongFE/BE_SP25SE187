import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function extractCellValue(cellValue: any): string {
  if (typeof cellValue === 'object' && cellValue?.text) {
    return cellValue.text;
  }
  return String(cellValue || '').trim();
}

export async function importExcel(filePath: string, userId: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    throw new Error('Worksheet is undefined');
  }

  const errors: string[] = [];
  let successCount = 0;

  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    const email = extractCellValue(row.getCell(1).value);
    const profession = extractCellValue(row.getCell(2).value);
    const specialty = extractCellValue(row.getCell(3).value);

    try {
      // Kiểm tra dữ liệu bắt buộc
      if (!email) throw new Error('Email is required');
      if (!profession) throw new Error('Major (profession) is required');

      // 1. Tìm hoặc tạo Major
      let major = await prisma.major.findUnique({ where: { name: profession } });
      if (!major) {
        major = await prisma.major.create({ data: { name: profession } });
      }

      // 2. Tìm hoặc tạo Specialization
      let specialization = await prisma.specialization.findFirst({
        where: { name: specialty, majorId: major.id },
      });
      if (!specialization && specialty) {
        specialization = await prisma.specialization.create({
          data: { name: specialty, majorId: major.id },
        });
      }

      // 3. Tìm hoặc tạo User
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            username: email.split('@')[0],
            passwordHash: 'defaultHash', // update sau loại bỏ passwordHash
          },
        });
      }

      // 4. Tìm hoặc tạo Student
      let student = await prisma.student.findFirst({
        where: { studentCode: email.split('@')[0] },
      });

      if (!student) {
        await prisma.student.create({
          data: {
            userId: user.id,
            majorId: major.id,
            specializationId: specialization?.id || null,
            studentCode: email.split('@')[0],
            importSource: 'excelImport',
          },
        });
        successCount++;
      } else {
        console.log(`Student with code ${email.split('@')[0]} already exists.`);
      }
    } catch (error) {
      console.error(`Error processing row ${i}:`, error);
      if (error instanceof Error) {
        errors.push(`Row ${i}: ${error.message}`);
      } else {
        errors.push(`Row ${i}: Unknown error`);
      }
    }
  }

  // Lưu log import
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

  // Ném lỗi nếu có lỗi
  if (errors.length) {
    throw new Error(`Import completed with errors: ${errors.join('\n')}`);
  }
}
