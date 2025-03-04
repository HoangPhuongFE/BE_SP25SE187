import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/hash';

const prisma = new PrismaClient();
const SYSTEM_DEFAULT_SEMESTER_ID = 'system-default-id'; // Thay bằng ID thực tế từ seed

interface CreateUserDTO {
  email: string;
  password: string;
  username: string;
  fullName?: string;
  roles: string[];
  semesterId?: string; // Thêm semesterId tùy chọn
}

interface UpdateRolesDTO {
  userId: string;
  roles: string[];
  semesterId?: string; // Thêm semesterId tùy chọn
}

export class AdminService {
  async createUser(data: CreateUserDTO) {
    const hashedPassword = await hashPassword(data.password);

    const roleIds = await prisma.role.findMany({
      where: { name: { in: data.roles } },
      select: { id: true },
    });

    const semesterId = data.semesterId || SYSTEM_DEFAULT_SEMESTER_ID; // Dùng SYSTEM_DEFAULT nếu không cung cấp

    return prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: hashedPassword,
        fullName: data.fullName,
        roles: {
          create: roleIds.map((role) => ({
            roleId: role.id,
            semesterId, // Thêm semesterId
            isActive: true,
          })),
        },
      },
      include: { roles: { include: { role: true } } },
    });
  }

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

    const semesterId = data.semesterId || SYSTEM_DEFAULT_SEMESTER_ID;

    await prisma.userRole.deleteMany({ where: { userId: data.userId } });

    await prisma.userRole.createMany({
      data: roleIds.map((role) => ({
        roleId: role.id,
        userId: data.userId,
        semesterId, // Thêm semesterId
        isActive: true,
      })),
    });

    return prisma.user.findUnique({
      where: { id: data.userId },
      include: { roles: { include: { role: true } } },
    });
  }

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

  async deleteUser(userId: string) {
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) throw new Error("User không tồn tại");

    await prisma.userRole.deleteMany({ where: { userId } });
    return prisma.user.delete({ where: { id: userId } });
  }

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

  async getUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
  }
}