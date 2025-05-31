import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword } from '../utils/hash';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import {  RegisterDTO } from '~/types/type';
import bcrypt from 'bcryptjs';
import {  USER_MESSAGE } from '~/constants/message';
import { sendEmail } from '../utils/email';
import { nowVN } from '../utils/date';
const prisma = new PrismaClient();

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
            roleId: studentRole.id,
            semesterId: data.semesterId,
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

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(nowVN().getTime() + 7 * 24 * 60 * 60 * 1000),
        type: 'refresh',
        createdAt: nowVN(),
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
        semesterId: user.roles[0]?.semesterId,
        roles: user.roles.map(userRole => ({
          id: userRole.role.id,
          name: userRole.role.name,
          isActive: userRole.isActive,
        })),
      },
    };
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
      where: { token: refreshToken, type: 'refresh' },
    });
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<{ message: string }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId, isDeleted: false },
      });
      if (!user) {
        throw new Error(USER_MESSAGE.USER_NOT_FOUND);
      }

      const isPasswordValid = await comparePassword(oldPassword, user.passwordHash);
      if (!isPasswordValid) {
        throw new Error(USER_MESSAGE.INVALID_PASSWORD);
      }

      if (newPassword.length < 6) {
        throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự');
      }

      const hashedNewPassword = await hashPassword(newPassword);

      await prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: hashedNewPassword,
          updatedAt: nowVN(),
        },
      });

      await prisma.systemLog.create({
        data: {
          userId: userId,
          action: 'CHANGE_PASSWORD',
          entityType: 'User',
          entityId: userId,
          description: `Người dùng "${user.username}" (${user.email}) đã thay đổi mật khẩu`,
          severity: 'INFO',
          ipAddress: 'unknown',
          createdAt: nowVN(),
        },
      });

      return { message: 'Thay đổi mật khẩu thành công!' };
    } catch (error) {
      throw new Error(`Lỗi khi thay đổi mật khẩu: ${(error as Error).message}`);
    }
  }

  // Tạo mã OTP ngẫu nhiên (6 chữ số)
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString(); // Tạo mã 6 chữ số
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    try {
      const user = await prisma.user.findUnique({
        where: { email, isDeleted: false },
      });
      if (!user) {
        throw new Error(USER_MESSAGE.USER_NOT_FOUND);
      }

      // Tạo mã OTP
      const otp = this.generateOTP();

      // Lưu mã OTP vào bảng RefreshToken với type: "otp"
      await prisma.refreshToken.create({
        data: {
          token: otp, // Lưu mã OTP vào trường token
          userId: user.id,
          expiresAt: new Date(nowVN().getTime() + 5 * 60 * 1000), // Hết hạn sau 5 phút
          type: 'otp',
          createdAt: nowVN(),
        },
      });

      // Nội dung email chứa mã OTP
      const emailContent = `
        <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
          <p>Xin chào <strong>${user.fullName || user.username}</strong>,</p>
          <p>Bạn đã yêu cầu khôi phục mật khẩu. Dưới đây là mã OTP của bạn:</p>
          <h2 style="color: #007bff;">${otp}</h2>
          <p>Mã này sẽ hết hạn sau 5 phút. Vui lòng sử dụng mã này để đặt lại mật khẩu.</p>
          <p>Nếu bạn không yêu cầu khôi phục mật khẩu, vui lòng bỏ qua email này.</p>
        </div>
      `;

      // Gửi email
      await sendEmail(user.email, 'Mã OTP Khôi phục mật khẩu', emailContent);

      // Ghi log
      await prisma.systemLog.create({
        data: {
          userId: user.id,
          action: 'FORGOT_PASSWORD_REQUEST',
          entityType: 'User',
          entityId: user.id,
          description: `Yêu cầu khôi phục mật khẩu cho "${user.username}" (${user.email}) với mã OTP`,
          severity: 'INFO',
          ipAddress: 'unknown',
          createdAt: nowVN(),
        },
      });

      return { message: 'Mã OTP đã được gửi tới email của bạn!' };
    } catch (error) {
      throw new Error(`Lỗi khi yêu cầu khôi phục mật khẩu: ${(error as Error).message}`);
    }
  }

  async resetPassword(email: string, otp: string, newPassword: string): Promise<{ message: string }> {
    try {
      // Tìm user theo email
      const user = await prisma.user.findUnique({
        where: { email, isDeleted: false },
      });
      if (!user) {
        throw new Error(USER_MESSAGE.USER_NOT_FOUND);
      }

      // Kiểm tra mã OTP
      const otpRecord = await prisma.refreshToken.findFirst({
        where: {
          token: otp,
          userId: user.id,
          type: 'otp',
          isDeleted: false,
          expiresAt: { gte: nowVN() },
        },
      });

      if (!otpRecord) {
        throw new Error('Mã OTP không hợp lệ hoặc đã hết hạn');
      }

      // Kiểm tra mật khẩu mới
      if (newPassword.length < 8) {
        throw new Error('Mật khẩu mới phải có ít nhất 8 ký tự');
      }

      // Băm mật khẩu mới
      const hashedNewPassword = await hashPassword(newPassword);

      // Cập nhật mật khẩu mới
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashedNewPassword,
          updatedAt: nowVN(),
        },
      });

      // Xóa mã OTP sau khi sử dụng
      await prisma.refreshToken.update({
        where: { id: otpRecord.id },
        data: {
          isDeleted: true,
        },
      });

      // Ghi log
      await prisma.systemLog.create({
        data: {
          userId: user.id,
          action: 'RESET_PASSWORD',
          entityType: 'User',
          entityId: user.id,
          description: `Mật khẩu của người dùng "${user.username}" (${user.email}) đã được đặt lại thành công`,
          severity: 'INFO',
          ipAddress: 'unknown',
          createdAt: nowVN(),
        },
      });

      return { message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.' };
    } catch (error) {
      throw new Error(`Lỗi khi đặt lại mật khẩu: ${(error as Error).message}`);
    }
  }

  async getUserProfile(userId: string) {
    try {
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
          isActive: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          roles: {
            select: {
              role: true,
            },
          },
          createdTopics: true,
          createdGroups: true,
          CouncilMember: true,
        },
      });

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
    isActive: boolean;
  }>): Promise<any> {
    try {
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        throw new Error(USER_MESSAGE.USER_NOT_FOUND);
      }

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
          isActive: data.isActive,
          updatedAt: nowVN(),
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
          isActive: true,
          updatedAt: true,
          roles: {
            select: {
              role: true,
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