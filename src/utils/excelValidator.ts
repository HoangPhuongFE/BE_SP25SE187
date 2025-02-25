import ExcelJS from 'exceljs';

export function validateExcelImport(
  worksheet: ExcelJS.Worksheet,
  requiredColumns: string[]
): string | null {
  // Kiểm tra worksheet có dữ liệu không
  if (worksheet.rowCount < 2) {
    return 'File Excel không có dữ liệu';
  }

  // Lấy header row
  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values as string[];

  // Kiểm tra các cột bắt buộc
  for (const required of requiredColumns) {
    if (!headers.includes(required)) {
      return `Thiếu cột bắt buộc: ${required}`;
    }
  }

  return null;
} 