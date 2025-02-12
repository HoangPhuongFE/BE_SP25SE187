import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword } from '../utils/hash';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { LoginDTO, RegisterDTO } from '~/types/type';
import bcrypt from 'bcrypt';


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
    // Tìm người dùng theo email
    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });

    if (!user) {
      throw new Error(USER_MESSAGE.USER_NOT_FOUND); // Người dùng không tồn tại
    }

    // So sánh mật khẩu đã mã hóa với mật khẩu nhập vào
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error(USER_MESSAGE.INVALID_PASSWORD); // Mật khẩu không đúng
    }

    // (Tuỳ chọn) Kiểm tra vai trò nếu bạn muốn giới hạn vai trò được phép đăng nhập
    if (!user.roles.some((role) => role.isActive)) {
      throw new Error(USER_MESSAGE.UNAUTHORIZED); // Vai trò không được phép
    }

    // Sinh accessToken và refreshToken
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return { accessToken, refreshToken };
  }

  generateAccessToken(user: any) {
    return jwt.sign(
      { userId: user.id, email: user.email, roles: user.roles.map((r: { roleId: any; }) => r.roleId) },
      process.env.JWT_SECRET || 'secret_key',
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

  async updateProfile(userId: string, data: { fullName?: string; avatar?: string }): Promise<any> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        fullName: data.fullName,
        avatar: data.avatar,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        avatar: true,
      },
    });
  }
}
