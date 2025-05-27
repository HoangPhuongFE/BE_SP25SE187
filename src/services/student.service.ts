import { Prisma, PrismaClient } from "@prisma/client";
import { paginate } from "../helpers/pagination.helper";
import { validate as isUUID } from "uuid";

const prisma = new PrismaClient();

export class StudentService {






  // Cập nhật student
  async updateStudent(studentId: string, data: { majorId: string; specializationId?: string | null; qualificationStatus?: string }) {
    if (!isUUID(studentId)) {
      throw new Error("Invalid Student ID format");
    }

    return prisma.student.update({
      where: { id: studentId },
      data: {
        majorId: data.majorId,
        specializationId: data.specializationId,
      },
      include: {
        user: true,
        major: true,
        specialization: true,
      },
    });
  }






  // Lấy danh sách student theo Semester
  async getStudentsBySemester(semesterId: string) {
    const students = await prisma.semesterStudent.findMany({
      where: {
        semesterId,
        isDeleted: false,
      },
      include: {
        semester: {
          select: {
            code: true,
            year: {
              select: {
                year: true,
                isDeleted: false
              }
            },
            isDeleted: false
          },
        },
        student: {
          select: {
            id: true,
            studentCode: true,
            user: {
              select: {
                username: true,
                email: true,
                isDeleted: false
              }
            },
            major: {
              select: {
                name: true,
                isDeleted: false
              }
            },
            specialization: {
              select: {
                name: true,
                isDeleted: false
              }
            },
            isDeleted: false
          }
        }
      }
    });

    return students.map((entry) => ({
      id: entry.student?.id,
      studentCode: entry.student?.studentCode,
      studentName: entry.student?.user?.username || "",
      email: entry.student?.user?.email || "",
      major: entry.student?.major?.name || "",
      specialization: entry.student?.specialization?.name || "",
      status: entry.status,
      qualificationStatus: entry.qualificationStatus,
      isEligible: entry.isEligible,
      semester: entry.semester?.year.year + " - " + entry.semester?.code,
      semesterId: entry.semesterId,
      block3: entry.block3,

    }));
  }



}
