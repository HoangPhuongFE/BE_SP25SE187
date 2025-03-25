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
  async  deleteStudent(studentId: string, userId?: string, ipAddress?: string): Promise<{ message: string; data: any } | undefined> {
    try {
      // Bước 1: Kiểm tra sinh viên có tồn tại và chưa bị xóa mềm
      const student = await prisma.student.findUnique({
        where: { id: studentId, isDeleted: false },
      });
      if (!student) {
        throw new Error('Sinh viên không tồn tại hoặc đã bị xóa');
      }
  
      // Bước 2: Thực hiện xóa mềm trong transaction
      const [updatedSemesterStudents, updatedGroupMembers, updatedGroupInvitations, updatedStudent] = await prisma.$transaction([
        // Xóa mềm SemesterStudent
        prisma.semesterStudent.updateMany({
          where: { studentId, isDeleted: false },
          data: { isDeleted: true },
        }),
        // Xóa mềm GroupMember
        prisma.groupMember.updateMany({
          where: { studentId, isDeleted: false },
          data: { isDeleted: true },
        }),
        // Xóa mềm GroupInvitation
        prisma.groupInvitation.updateMany({
          where: { studentId, isDeleted: false },
          data: { isDeleted: true },
        }),
        // Xóa mềm Student
        prisma.student.update({
          where: { id: studentId },
          data: { isDeleted: true },
        }),
      ]);
  
      // Bước 3: Ghi log hành động (tuỳ chọn, nếu hệ thống có bảng SystemLog)
      if (userId) {
        await prisma.systemLog.create({
          data: {
            userId,
            action: 'DELETE_STUDENT',
            entityType: 'Student',
            entityId: studentId,
            description: `Sinh viên ${student.studentCode} đã được đánh dấu xóa`,
            severity: 'INFO',
            ipAddress: ipAddress || 'unknown',
            metadata: {
              updatedSemesterStudents: updatedSemesterStudents.count,
              updatedGroupMembers: updatedGroupMembers.count,
              updatedGroupInvitations: updatedGroupInvitations.count,
            },
          },
        });
      }
  
      return { message: 'Xóa sinh viên thành công', data: updatedStudent };
    } catch (error) {
      // Ghi log lỗi (tuỳ chọn)
      if (userId) {
        await prisma.systemLog.create({
          data: {
            userId,
            action: 'DELETE_STUDENT_ERROR',
            entityType: 'Student',
            entityId: studentId,
            description: 'Lỗi khi xóa sinh viên',
            severity: 'ERROR',
            error: error instanceof Error ? error.message : 'Unknown error',
            ipAddress: ipAddress || 'unknown',
          },
        });
      }
      return undefined; // Ensure a return value in the catch block
    }
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
