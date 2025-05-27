import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class MajorService {
  async getAllMajors(params: {
    page: number;
    pageSize: number;
    search?: string;
  }) {
    const { page, pageSize, search } = params;

    // Xây dựng điều kiện tìm kiếm
    const where = search ? {
      OR: [
        { name: { contains: search } },
      ]
    } : {};

    // Lấy tổng số bản ghi
    const totalItems = await prisma.major.count({ where });

    // Lấy dữ liệu phân trang
    const majors = await prisma.major.findMany({
      where,
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' }
    });

    return {
      data: majors,
      pagination: {
        total: totalItems,
        page,
        pageSize,
        totalPages: Math.ceil(totalItems / pageSize)
      }
    };
  }

  
}


