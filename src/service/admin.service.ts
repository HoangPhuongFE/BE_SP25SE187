import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/hash';

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


}