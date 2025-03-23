import { Prisma, PrismaClient } from "@prisma/client";
import { paginate } from "../helpers/pagination.helper";
import { validate as isUUID } from "uuid";

const prisma = new PrismaClient();

export class StudentService {
  // Lấy danh sách sinh viên toàn bộ (nếu cần)
  async fetchStudentList() {
    const students = await prisma.semesterStudent.findMany({
      where: {
        isDeleted: false,
      },
      include: {
        student: {
          select: {
            id: true,
            studentCode: true,
            user: {
              select: {
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
      email: entry.student?.user?.email || "",
      major: entry.student?.major?.name || "",
      specialization: entry.student?.specialization?.name || "",
      status: entry.status,
      student_code: entry.student?.studentCode,
      qualificationStatus: entry.qualificationStatus,
      semesterId: entry.semesterId,
    }));
  }
  
  

  // Lấy danh sách sinh viên phân trang
  async getPaginatedStudents(page: number, pageSize: number) {
    return paginate(prisma.semesterStudent, { page, pageSize }, {
      where: {
        isDeleted: false,
        student: {
          isDeleted: false
        }
      },
      select: {
        student: {
          select: {
            id: true,
            studentCode: true, 
            user: {
              where: { isDeleted: false },
              select: { email: true }
            },
            major: {
              where: { isDeleted: false },
              select: { name: true }
            },
            specialization: {
              where: { isDeleted: false },
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
    await prisma.$transaction([
      prisma.semesterStudent.deleteMany({ where: { studentId } }),
      prisma.groupMember.deleteMany({ where: { studentId } }),
      prisma.groupInvitation.deleteMany({ where: { studentId } }),
      prisma.student.delete({ where: { id: studentId } }),
    ]);
  }
  
  

// Lấy danh sách student theo Semester
async getStudentsBySemester(semesterId: string) {
  try {
      const semesterStudents = await prisma.semesterStudent.findMany({
          where: {
              semesterId,
              isDeleted: false,
              student: { isDeleted: false }, // Lọc student chưa bị xóa
              semester: { isDeleted: false }, // Lọc semester chưa bị xóa
          },
          include: {
              student: {
                  include: {
                      user: true, // Lấy toàn bộ user
                      major: true, // Lấy toàn bộ major
                      specialization: true, // Lấy toàn bộ specialization
                  },
              },
              semester: {
                  include: {
                      year: true, // Lấy toàn bộ year
                  },
              },
          },
      });

      // Format dữ liệu trả về với lọc isDeleted
      return semesterStudents.map((entry) => ({
          id: entry.student?.id ?? "",
          studentCode: entry.student?.studentCode ?? "",
          studentName:
              entry.student?.user?.isDeleted === false
                  ? entry.student.user.fullName ?? "Không có tên"
                  : "Không có tên",
          email:
              entry.student?.user?.isDeleted === false
                  ? entry.student.user.email ?? "Không có email"
                  : "Không có email",
          major:
              entry.student?.major?.isDeleted === false
                  ? entry.student.major.name ?? "Không có ngành"
                  : "Không có ngành",
          specialization:
              entry.student?.specialization?.isDeleted === false
                  ? entry.student.specialization.name ?? "Không có chuyên môn"
                  : "Không có chuyên môn",
          status: entry.status,
          qualificationStatus: entry.qualificationStatus,
          isEligible: entry.isEligible,
          registeredAt: entry.registeredAt,
          semesterCode:
              entry.semester?.isDeleted === false
                  ? entry.semester.code ?? ""
                  : "",
          year:
              entry.semester?.year?.isDeleted === false
                  ? entry.semester.year.year ?? null
                  : null,
      }));
  } catch (error) {
      console.error("Lỗi trong getStudentsBySemester:", error);
      throw error;
  }
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
