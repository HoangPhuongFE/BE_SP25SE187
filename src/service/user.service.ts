import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword } from '../utils/hash';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { LoginDTO, RegisterDTO } from '~/types/type';
import bcrypt from 'bcryptjs';
import { AUTH_MESSAGE, USER_MESSAGE } from '~/constants/message';

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const SYSTEM_DEFAULT_SEMESTER_ID = 'system-default-id'; // Thay bằng ID thực tế từ seed
const DEFAULT_STUDENT_SEMESTER_ID = 'spring-2025-id'; // Thay bằng ID thực tế của SPRING2025 từ seed

export class UserService {
  async register(data: RegisterDTO & { semesterId?: string }) {
    const hashedPassword = await hashPassword(data.password);

    const studentRole = await prisma.role.findFirst({ where: { name: 'student' } });
    if (!studentRole) throw new Error('Student role not found');

    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: hashedPassword,
        fullName: data.fullName,
        roles: {
          create: {
            roleId: studentRole.id, // Dùng role "student" mặc định
            semesterId: data.semesterId || DEFAULT_STUDENT_SEMESTER_ID, // Mặc định cho student
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
            role: true,
          },
        },
      },
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
      isActive: r.isActive,
    }));

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Lưu refresh token vào database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày
      },
    });

    return {
      message: "Login successful",
      accessToken,
      refreshToken,
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
          isActive: userRole.isActive,
        })),
      },
    };
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

    const studentRole = await prisma.role.findFirst({ where: { name: 'student' } });
    if (!studentRole) throw new Error('Student role not found');

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
              roleId: studentRole.id,
              semesterId: DEFAULT_STUDENT_SEMESTER_ID, // Mặc định cho student
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
    const refreshToken = this.generateRefreshToken(user);

    // Lưu refresh token vào database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày
      },
    });

    return { accessToken, refreshToken };
  }

  generateAccessToken(user: any) {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        roles: user.roles.map((r: { roleId: string; semesterId: string }) => ({
          roleId: r.roleId,
          semesterId: r.semesterId,
        })),
      },
      process.env.JWT_SECRET_ACCESS_TOKEN || 'secret_key',
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

  async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
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
  
  async updateProfile(userId: string, data: Partial<{
    username: string;
    fullName: string;
    avatar: string;
    gender: string;
    phone: string;
    personal_Email: string;
    profession: string;
    specialty: string;
    programming_language: string;
    lecturerCode: string;
    student_code: string;
    semester_user: string;
    isActive: boolean;
  }>): Promise<any> {
    try {
      // Kiểm tra xem người dùng có tồn tại không
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      });
  
      if (!existingUser) {
        throw new Error(USER_MESSAGE.USER_NOT_FOUND);
      }
  
      // Cập nhật thông tin người dùng
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          username: data.username,
          fullName: data.fullName,
          avatar: data.avatar,
          gender: data.gender,
          phone: data.phone,
          personal_Email: data.personal_Email,
          profession: data.profession,
          specialty: data.specialty,
          programming_language: data.programming_language,
          lecturerCode: data.lecturerCode,
          student_code: data.student_code,
          semester_user: data.semester_user,
          isActive: data.isActive,
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
          lecturerCode: true,
          student_code: true,
          semester_user: true,
          isActive: true,
          updatedAt: true,
          roles: {
            select: {
              role: true, // Lấy thông tin vai trò của người dùng
            },
          },
          groupMemberships: {
            select: {
              groupId: true,
              role: true,
            },
          },
          mentorGroups: {
            select: {
              groupId: true,
            },
          },
        },
      });
  
      return updatedUser;
    } catch (error) {
      throw new Error(`Lỗi khi cập nhật hồ sơ: ${(error as Error).message}`);
    }
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