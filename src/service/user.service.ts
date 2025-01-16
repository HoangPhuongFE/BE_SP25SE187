import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword } from '../utils/hash';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

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

  async login(data: LoginDTO) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) throw new Error('User not found');

    const isValidPassword = await comparePassword(data.password, user.passwordHash);
    if (!isValidPassword) throw new Error('Invalid password');

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    return { accessToken, refreshToken };
  }

  private generateAccessToken(user: any) {
    if (!process.env.JWT_SECRET_ACCESS_TOKEN) {
      throw new Error('JWT_SECRET_ACCESS_TOKEN is not defined');
    }

    const roles = user.roles
      ?.filter((userRole: any) => userRole.isActive)
      ?.map((userRole: any) => userRole.role?.name)
      ?.filter(Boolean) || [];

    return jwt.sign(
      {
        userId: user.id,
        roles,
      },
      process.env.JWT_SECRET_ACCESS_TOKEN,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m' },
    );
  }

  private async generateRefreshToken(user: any) {
    if (!process.env.JWT_SECRET_REFRESH_TOKEN) {
      throw new Error('JWT_SECRET_REFRESH_TOKEN is not defined');
    }

    const roles = user.roles
      ?.filter((userRole: any) => userRole.isActive)
      ?.map((userRole: any) => userRole.role?.name)
      ?.filter(Boolean) || [];

    const token = jwt.sign(
      {
        userId: user.id,
        roles,
      },
      process.env.JWT_SECRET_REFRESH_TOKEN,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' },
    );

    await prisma.refreshToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return token;
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

  async createDefaultUsers() {
    const defaultUsers = [
      {
        email: 'student@gmail.com',
        username: 'student',
        password: await hashPassword('12345'),
        fullName: 'Student User',
        roleId: 'student-role-id',
      },
      {
        email: 'lecturer@gmail.com',
        username: 'lecturer',
        password: await hashPassword('12345'),
        fullName: 'Lecturer User',
        roleId: 'lecturer-role-id',
      },
    ];

    for (const user of defaultUsers) {
      const roleExists = await prisma.role.findUnique({
        where: { id: user.roleId },
      });

      if (!roleExists) {
        throw new Error(`Role with ID ${user.roleId} does not exist`);
      }

      await prisma.user.create({
        data: {
          email: user.email,
          username: user.username,
          passwordHash: user.password,
          fullName: user.fullName,
          roles: {
            create: {
              roleId: user.roleId,
              isActive: true,
            },
          },
        },
      });

      console.log(`User created: ${user.username}`);
    }
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
