  import { PrismaClient } from '@prisma/client';
  import { paginate } from '../helpers/pagination.helper';

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
