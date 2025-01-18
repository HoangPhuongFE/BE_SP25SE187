import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/hash';
import * as XLSX from 'xlsx';
import { generateUsername } from '../utils/generator';
import * as fs from 'fs';

const prisma = new PrismaClient();

interface CreateUserDTO {
  email: string;
  password: string;
  username: string;
  fullName?: string;
  roles: string[];
}
interface UpdateRolesDTO {
  userId: string;
  roles: string[];
}
interface ExcelUserData {
  email: string;
  profession?: string;
  specialty?: string;
}
export class AdminService {
  // Hàm tạo mới user
  async createUser(data: CreateUserDTO) {
    const hashedPassword = await hashPassword(data.password);

    // Lấy role IDs từ tên role
    const roleIds = await prisma.role.findMany({
      where: {
        name: {
          in: data.roles
        }
      },
      select: {
        id: true
      }
    });

    return await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: hashedPassword,
        fullName: data.fullName,
        roles: {
          create: roleIds.map(role => ({
            roleId: role.id,
            isActive: true
          }))
        }
      },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    });
  }


  // Hàm thay đổi roles cho user
  async updateUserRoles(data: UpdateRolesDTO) {
    // Kiểm tra user có tồn tại hay không
    const userExists = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!userExists) {
      throw new Error('User not found');
    }

    // Lấy danh sách role IDs từ tên roles
    const roleIds = await prisma.role.findMany({
      where: {
        name: {
          in: data.roles,
        },
      },
      select: {
        id: true,
      },
    });

    if (roleIds.length === 0) {
      throw new Error('No valid roles found');
    }

    // Xóa tất cả roles cũ của user
    await prisma.userRole.deleteMany({
      where: {
        userId: data.userId,
      },
    });

    // Thêm roles mới
    const newRoles = roleIds.map((role) => ({
      roleId: role.id,
      userId: data.userId,
      isActive: true,
    }));

    await prisma.userRole.createMany({
      data: newRoles,
    });

    // Trả về user với roles mới
    return prisma.user.findUnique({
      where: { id: data.userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async importUsersFromExcel(filePath: string) {
    try {
      // Đọc file Excel
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet) as ExcelUserData[];

      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[]
      };

      // Lấy student role ID
      const studentRole = await prisma.role.findFirst({
        where: { name: 'student' },
        select: { id: true }
      });

      if (!studentRole) {
        throw new Error('Student role not found');
      }

      // Xử lý từng dòng dữ liệu
      for (const row of data) {
        try {
          // Kiểm tra email hợp lệ
          if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
            results.failed++;
            results.errors.push(`Email ${row.email} không hợp lệ`);
            continue;
          }

          // Kiểm tra email tồn tại
          const existingUser = await prisma.user.findUnique({
            where: { email: row.email }
          });

          if (existingUser) {
            results.failed++;
            results.errors.push(`Email ${row.email} đã tồn tại`);
            continue;
          }

          // Tạo username từ email
          const username = generateUsername(row.email);
          // Tạo mật khẩu mặc định
          const defaultPassword = await hashPassword('123456');

          // Tạo user mới
          await prisma.user.create({
            data: {
              email: row.email,
              username: username,
              passwordHash: defaultPassword,
              profession: row.profession,
              specialty: row.specialty,
              roles: {
                create: {
                  roleId: studentRole.id,
                  isActive: true
                }
              }
            }
          });

          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Lỗi khi xử lý ${row.email}: ${(error as Error).message}`);
        }
      }

      return results;
    } finally {
      // Xóa file sau khi xử lý xong
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.error('Lỗi khi xóa file:', error);
      }
    }
  }
} 