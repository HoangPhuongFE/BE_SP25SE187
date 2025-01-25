  import { PrismaClient } from '@prisma/client';
  import { paginate } from '../helpers/pagination.helper';
  import { validate as isUUID } from 'uuid';
  const prisma = new PrismaClient();
  // Hàm lấy danh sách sinh viên toàn bộ
  export async function fetchStudentList() {
    return await prisma.student.findMany({
      include: {
        user: true,
        major: true,
        specialization: true,
      },
    });
  }


  // Hàm lấy danh sách sinh viên phân trang
  export const getPaginatedStudents = async (page: number, pageSize: number) => {
    return await paginate(prisma.student, { page, pageSize }, {
      include: {
        user: true,
        major: true,
        specialization: true,
      },
    });
  };



export const updateStudent = async (studentId: string, data: any) => {
  if (!isUUID(studentId)) {
    throw new Error('Invalid Student ID format');
  }

  return await prisma.student.update({
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
};

  
export const deleteStudent = async (studentId: string) => {
  try {
    return await prisma.student.delete({
      where: { userId: studentId },
    });
  } catch (error) {
    if ((error as { code: string }).code === 'P2025') {
      // Lỗi khi không tìm thấy bản ghi
      throw new Error('Student not found');
    }
    throw error;
  }
};

  
export const getStudentsBySemesterService = async (semesterId: number) => {
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

  return students.map((entry) => ({
    id: entry.student.id,
    email: entry.student.user?.email || "",
    major: entry.student.major.name || "",
    specialization: entry.student.specialization?.name || "",
    status: entry.status,
  }));
};
