import { Prisma, PrismaClient } from "@prisma/client";
import { paginate } from "../helpers/pagination.helper";
import { validate as isUUID } from "uuid";

const prisma = new PrismaClient();

export class StudentService {
  // Lấy danh sách sinh viên toàn bộ (nếu cần)
  async fetchStudentList() {
    const students = await prisma.semesterStudent.findMany({
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
      student_code: entry.student.studentCode,
      qualificationStatus: entry.qualificationStatus,
      semesterId: entry.semesterId,
    }));
  }
  
  

  // Lấy danh sách sinh viên phân trang
  async getPaginatedStudents(page: number, pageSize: number) {
    return paginate(prisma.semesterStudent, { page, pageSize }, {
      select: {
        student: {
          select: {
            id: true,
            studentCode: true, 
            user: {
              select: { email: true }
            },
            major: {
              select: { name: true }
            },
            specialization: {
              select: { name: true }
            },
          }
        },
        status: true,
        qualificationStatus: true,
        semesterId: true
      }
    });
  }
  

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
    const students = await prisma.semesterStudent.findMany({
      where: { semesterId },
      include: {
        semester: {    
          select: {
            code: true,  
            year: { select: { year: true } },  
          },
        },
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
      studentCode: entry.student.studentCode, 
      studentName: entry.student.user?.fullName || "Không có tên",
      email: entry.student.user?.email || "",
      major: entry.student.major?.name || "",
      specialization: entry.student.specialization?.name || "",
      status: entry.status,
      qualificationStatus: entry.qualificationStatus,
    }));
  }
  
  
  async deleteAllStudentsInSemester(semesterId: string) {
    try {
      // Xóa tất cả các bản ghi trong bảng semesterStudent
      await prisma.semesterStudent.deleteMany({
        where: { semesterId }
      });
  
      // Xóa sinh viên không còn liên kết với bất kỳ semester nào
      await prisma.student.deleteMany({
        where: {
          semesterStudents: {
            none: {}  // Không còn bất kỳ liên kết nào trong semesterStudent
          }
        }
      });
  
      return { message: "All students in the semester have been deleted successfully." };
    } catch (error) {
      console.error("Error deleting students:", error);
      throw new Error("Failed to delete students in semester.");
    }
  }
  
  
}
