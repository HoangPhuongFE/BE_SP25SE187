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
  student_code: string;
  major_id: string;
  specialization_id?: string;
  personal_email?: string;
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
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet) as ExcelUserData[];

      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[]
      };

      // Xử lý từng dòng dữ liệu
      for (const row of data) {
        try {
          // Kiểm tra email hợp lệ
          if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
            results.failed++;
            results.errors.push(`Email ${row.email} không hợp lệ`);
            continue;
          }

          // Kiểm tra student_code bắt buộc
          if (!row.student_code) {
            results.failed++;
            results.errors.push(`Thiếu mã sinh viên cho email ${row.email}`);
            continue;
          }

          // Kiểm tra major_id tồn tại
          const major = await prisma.major.findFirst({
            where: { id: parseInt(row.major_id) }
          });

          if (!major) {
            results.failed++;
            results.errors.push(`Major ID ${row.major_id} không tồn tại cho sinh viên ${row.student_code}`);
            continue;
          }

          // Kiểm tra specialization_id nếu có
          if (row.specialization_id) {
            const specialization = await prisma.specialization.findFirst({
              where: { 
                id: parseInt(row.specialization_id),
                majorId: parseInt(row.major_id)
              }
            });

            if (!specialization) {
              results.failed++;
              results.errors.push(`Specialization ID ${row.specialization_id} không hợp lệ cho major ${row.major_id}`);
              continue;
            }
          }

          // Tạo bản ghi student mới
          await prisma.student.create({
            data: {
              studentCode: row.student_code,
              majorId: parseInt(row.major_id),
              specializationId: row.specialization_id ? parseInt(row.specialization_id) : null,
              personalEmail: row.personal_email || null,
              status: 'PENDING',
              isImported: true,
              importAt: new Date(),
              importSource: 'EXCEL'
            }
          });

          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Lỗi khi xử lý ${row.email}: ${(error as Error).message}`);
        }
      }

      // Ghi log import
      await prisma.importLog.create({
        data: {
          source: 'EXCEL',
          fileName: filePath.split('/').pop() || '',
          importBy: {
            connect: {
              id: 'admin-user-id' // Cần thay thế bằng ID của user thực hiện import
            }
          },
          totalRecords: data.length,
          successRecords: results.success,
          errorRecords: results.failed,
          errorsDetails: JSON.stringify(results.errors)
        }
      });

      return results;
    } finally {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.error('Lỗi khi xóa file:', error);
      }
    }
  }
} 