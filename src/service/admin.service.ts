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
  //  Tạo user mới
  async createUser(data: CreateUserDTO) {
    const hashedPassword = await hashPassword(data.password);

    // Lấy role IDs từ tên role
    const roleIds = await prisma.role.findMany({
      where: { name: { in: data.roles } },
      select: { id: true },
    });

    return prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: hashedPassword,
        fullName: data.fullName,
        roles: {
          create: roleIds.map((role) => ({
            roleId: role.id,
            isActive: true,
          })),
        },
      },
      include: { roles: { include: { role: true } } },
    });
  }

  //  Cập nhật roles của user
  async updateUserRoles(data: UpdateRolesDTO) {
    console.log(`DEBUG: Checking user ID: ${data.userId}`);

    const userExists = await prisma.user.findUnique({ where: { id: data.userId } });
    console.log("DEBUG: User Exists:", userExists);

    if (!userExists) throw new Error('User không tồn tại');

    const roleIds = await prisma.role.findMany({
      where: { name: { in: data.roles } },
      select: { id: true },
    });

    console.log("DEBUG: Role IDs:", roleIds);

    if (roleIds.length === 0) throw new Error('Không tìm thấy roles hợp lệ');

    // Xóa tất cả roles cũ của user
    await prisma.userRole.deleteMany({ where: { userId: data.userId } });

    // Thêm roles mới
    await prisma.userRole.createMany({
      data: roleIds.map((role) => ({
        roleId: role.id,
        userId: data.userId,
        isActive: true,
      })),
    });

    return prisma.user.findUnique({
      where: { id: data.userId },
      include: { roles: { include: { role: true } } },
    });
}


  //  Cập nhật thông tin user
  async updateUser(userId: string, data: { email?: string; username?: string; fullName?: string }) {
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) throw new Error("User không tồn tại");

    return prisma.user.update({
      where: { id: userId },
      data: {
        email: data.email || existingUser.email,
        username: data.username || existingUser.username,
        fullName: data.fullName || existingUser.fullName,
      },
      include: { roles: { include: { role: true } } },
    });
  }

  //  Xóa user
  async deleteUser(userId: string) {
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) throw new Error("User không tồn tại");

    await prisma.userRole.deleteMany({ where: { userId } }); // Xóa roles trước
    return prisma.user.delete({ where: { id: userId } }); // Xóa user
  }

  //  Lấy danh sách user
  async getUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        roles: { select: { role: true } },
      },
    });
  }

  //  Lấy user theo ID
  async getUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
  }
}
