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

export class AdminService {
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
} 