import { Prisma, PrismaClient } from "@prisma/client";
import { paginate } from "../helpers/pagination.helper";
import { validate as isUUID } from "uuid";

const prisma = new PrismaClient();

export class StudentService {
  // Lấy danh sách sinh viên toàn bộ (nếu cần)
  async fetchStudentList() {
    return prisma.student.findMany({
      include: {
        user: true,
        major: true,
        specialization: true,
      },
    });
  }

  // Lấy danh sách sinh viên phân trang
  async getPaginatedStudents(page: number, pageSize: number) {
    return paginate(prisma.student, { page, pageSize }, {
      include: {
        user: true,
        major: true,
        specialization: true,
      },
    });
  }

  // Cập nhật student
  async updateStudent(studentId: string, data: { majorId: string; specializationId?: string | null }) {
    if (!isUUID(studentId)) {
      throw new Error("Invalid Student ID format");
    }

    return prisma.student.update({
      where: { userId: studentId },
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

  // Xoá student
  async deleteStudent(studentId: string) {
    try {
      return await prisma.student.delete({
        where: { userId: studentId },
      });
    } catch (error) {
      if ((error as any).code === "P2025") {
        throw new Error("Student not found");
      }
      throw error;
    }
  }

  // Lấy danh sách student theo Semester
  async getStudentsBySemester(semesterId: string) {
    type SemesterStudentWithStudent = Prisma.SemesterStudentGetPayload<{
      include: {
        student: {
          include: {
            user: true;
            major: true;
            specialization: true;
          };
        };
      };
    }>;

    const students: SemesterStudentWithStudent[] = await prisma.semesterStudent.findMany({
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

    return students.map((entry) => ({
      id: entry.student.id,
      email: entry.student.user?.email || "",
      major: entry.student.major?.name || "",
      specialization: entry.student.specialization?.name || "",
      status: entry.status,
    }));
  }
}
