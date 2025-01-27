import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function extractCellValue(cellValue: any): string {
  if (typeof cellValue === 'object' && cellValue?.text) {
    return cellValue.text;
  }
  return String(cellValue || '').trim();
}

export async function importConditionExcel(filePath: string, semesterId: number, userId: string) {
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
    const status = extractCellValue(row.getCell(2).value);

    try {
      // Kiểm tra dữ liệu bắt buộc
      if (!email) throw new Error('Email is required');
      if (!status) throw new Error('Status is required');

      // Tìm student qua email
      const student = await prisma.student.findFirst({
        where: { user: { email } },
      });

      if (!student) {
        throw new Error(`Student with email ${email} not found`);
      }

      // Cập nhật thông tin student vào bảng SemesterStudent
      await prisma.semesterStudent.upsert({
        where: { semesterId_studentId: { semesterId, studentId: student.id } },
        update: { status },
        create: { semesterId, studentId: student.id, status },
      });

      successCount++;
    } catch (error) {
      console.error(`Error processing row ${i}:`, error);
      if (error instanceof Error) {
        errors.push(`Row ${i}: ${error.message}`);
      } else {
        errors.push(`Row ${i}: Unknown error`);
      }
    }
  }

  // Tính tổng số bản ghi
  const totalRecords = worksheet.rowCount - 1;

  // Lưu log import
  const fileName = filePath.split('/').pop();
  await prisma.importLog.create({
    data: {
      source: 'Condition Import',
      fileName: fileName || 'unknown',
      importById: userId,
      totalRecords,
      successRecords: successCount,
      errorRecords: errors.length,
      errorsDetails: errors.join('\n'),
    },
  });

  return {
    totalRecords,
    successRecords: successCount,
    errorRecords: errors.length,
    errors,
  };
}
