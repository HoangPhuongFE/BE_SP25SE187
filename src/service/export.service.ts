import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import path from "path";
import fs from "fs";
import { EXPORT_MESSAGE } from "../constants/message";

const prisma = new PrismaClient();

export const exportStudentListService = async (semesterId: string): Promise<string | null> => {
  // 1. Tìm SemesterStudent bằng where: { semesterId } (string)
  const students = await prisma.semesterStudent.findMany({
    where: { semesterId },
    include: {
      student: {
        include: {
          user: true,
          major: true,
          specialization: true,
        },
      },
    },
  });

  if (!students || students.length === 0) {
    throw new Error(EXPORT_MESSAGE.NO_DATA_FOUND);
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Student List");

  worksheet.columns = [
    { header: "Email", key: "email", width: 30 },
    { header: "Major", key: "major", width: 20 },
    { header: "Specialization", key: "specialization", width: 20 },
    { header: "Status", key: "status", width: 15 },
  ];

  students.forEach((entry) => {
    // entry.student đã được include
    worksheet.addRow({
      email: entry.student.user?.email || "",
      major: entry.student.major?.name || "",
      specialization: entry.student.specialization?.name || "",
      status: entry.status,
    });
  });

  const exportDir = path.resolve(__dirname, "../../exports");
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(exportDir, `Student_List_Semester_${semesterId}_${timestamp}.xlsx`);
  await workbook.xlsx.writeFile(filePath);

  return filePath;
};

export const exportConditionListService = async (semesterId: string): Promise<string | null> => {
  // 2. Tương tự, where: { semesterId } (string)
  const conditions = await prisma.semesterStudent.findMany({
    where: { semesterId },
    include: {
      student: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!conditions || conditions.length === 0) {
    throw new Error(EXPORT_MESSAGE.NO_DATA_FOUND);
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Condition List");

  worksheet.columns = [
    { header: "Email", key: "email", width: 30 },
    { header: "Status", key: "status", width: 15 },
  ];

  conditions.forEach((entry) => {
    worksheet.addRow({
      email: entry.student.user?.email || "",
      status: entry.isEligible ? "Qualified" : "Not Qualified",
    });
  });

  const exportDir = path.resolve(__dirname, "../../exports");
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(
    exportDir,
    `Condition_List_Semester_${semesterId}_${timestamp}.xlsx`
  );
  await workbook.xlsx.writeFile(filePath);

  return filePath;
};
