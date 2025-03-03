import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword } from '../utils/hash';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { LoginDTO, RegisterDTO } from '~/types/type';
import bcrypt from 'bcryptjs';

import { AUTH_MESSAGE ,USER_MESSAGE } from '~/constants/message';
const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export class UserService {
  async register(data: RegisterDTO) {
    const hashedPassword = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: hashedPassword,
        fullName: data.fullName,
        roles: {
          create: {
            roleId: 'student-role-id',
            isActive: true,
          },
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    return user;
  }

  async login({ email, password }: { email: string; password: string }) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    });

    if (!user) {
      throw new Error(USER_MESSAGE.USER_NOT_FOUND);
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error(USER_MESSAGE.INVALID_PASSWORD);
    }

    if (!user.roles.some(role => role.isActive)) {
      throw new Error(USER_MESSAGE.UNAUTHORIZED);
    }

    const roles = user.roles.map((r) => ({
        id: r.role?.id || null, 
        name: r.role?.name || "Unknown Role",
        description: r.role?.description || "No description",
        isActive: r.isActive
    }));

    return { 
        message: "Login successful",
        accessToken: this.generateAccessToken(user),
        refreshToken: this.generateRefreshToken(user),
        roles,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          avatar: user.avatar,
          roles: user.roles.map(userRole => ({
            id: userRole.role.id,
            name: userRole.role.name,
            isActive: userRole.isActive
          }))
        }
    };
}


async getUserProfile(userId: string) {
  try {
    // Truy vấn dữ liệu người dùng từ cơ sở dữ liệu (Lấy thông tin người dùng với tất cả các mối quan hệ)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        lecturerCode: true,
        avatar: true,
        student_code: true,
        profession: true,
        specialty: true,
        programming_language: true,
        gender: true,
        phone: true,
        personal_Email: true,
        semester_user: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          select: {
            role: true,  // Lấy thông tin các vai trò của người dùng
          },
        },
        // Các quan hệ khác (ví dụ, topics, students, group memberships, v.v.)
        createdTopics: true,
        createdGroups: true,
        CouncilMember: true, // Thêm các quan hệ khác nếu cần
      },
    });

    // Nếu người dùng không tồn tại
    if (!user) {
      throw new Error('User not found');
    }

    return user;
  } catch (error) {
    throw new Error(`Error fetching user profile: ${(error as Error).message}`);
  }
}



  generateAccessToken(user: any) {
    return jwt.sign(
      { userId: user.id, email: user.email, roles: user.roles.map((r: { roleId: any; }) => r.roleId) },
      process.env.JWT_SECRET_ACCESS_TOKEN  || 'secret_key',
      { expiresIn: '1h' }
    );
  }

  generateRefreshToken(user: any) {
    return jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET || 'refresh_secret_key',
      { expiresIn: '7d' }
    );
  }



  async loginWithGoogle(idToken: string) {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.email) throw new Error('Invalid Google token');

    let user = await prisma.user.findUnique({
      where: { email: payload.email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email,
          username: payload.email.split('@')[0],
          fullName: payload.name,
          avatar: payload.picture,
          passwordHash: await hashPassword(Math.random().toString(36)),
          roles: {
            create: {
              roleId: 'student-role-id',
              isActive: true,
            },
          },
        },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    return { accessToken, refreshToken };
  }


  async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  async updateProfile(userId: string, data: { 
    fullName?: string; 
    avatar?: string;
    gender?: string;
    phone?: string;
    personal_Email?: string;
    profession?: string;
    specialty?: string;
    programming_language?: string;
  }): Promise<any> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        fullName: data.fullName,
        avatar: data.avatar,
        gender: data.gender,
        phone: data.phone,
        personal_Email: data.personal_Email,
        profession: data.profession,
        specialty: data.specialty,
        programming_language: data.programming_language,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        avatar: true,
        gender: true,
        phone: true,
        personal_Email: true,
        profession: true,
        specialty: true,
        programming_language: true,
        updatedAt: true,
      },
    });
  }
  

  async getUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        avatar: true,
        student_code: true,
        profession: true,
        specialty: true,
        programming_language: true,
        gender: true,
        phone: true,  
        semester_user: true,
        personal_Email: true,  
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          select: {
            role: true,
          },
        },
        students: {
          select: {
            id: true,
            majorId: true,
            specializationId: true,
            isEligible: true,
          },
        },
        groupMemberships: {
          select: {
            groupId: true,
            role: true,
          },
        },
      },
    });
  }
  
  
  
  async getUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        avatar: true,
        student_code: true,
        profession: true,
        specialty: true,
        programming_language: true,
        gender: true,  
        personal_Email: true, 
        semester_user: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          select: {
            role: true,
          },
        },
        students: {
          select: {
            id: true,
            majorId: true,
            specializationId: true,
            isEligible: true,
          },
        },
        groupMemberships: {
          select: {
            groupId: true,
            role: true,
          },
        },
      },
    });
  }
  
}