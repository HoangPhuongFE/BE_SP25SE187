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
      // Xóa các bản ghi liên quan trong các bảng khác trước
      await prisma.semesterStudent.deleteMany({
        where: { studentId },
      });
  
      await prisma.groupMember.deleteMany({
        where: { studentId },
      });
  
      await prisma.groupInvitation.deleteMany({
        where: { studentId },
      });
  
      // Cuối cùng, xóa bản ghi student
      return await prisma.student.delete({
        where: { id: studentId },
      });
    } catch (error) {
      if ((error as any).code === "P2025") {
        throw new Error("Student not found");
      } else if ((error as any).code === "P2003") {
        throw new Error("Cannot delete student due to related records in other tables.");
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
