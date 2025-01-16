import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword } from '../utils/hash';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export class UserService {
  async register(data: RegisterDTO) {
    const hashedPassword = await hashPassword(data.password);
    
    // Tạo user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: hashedPassword,
        fullName: data.fullName,
        roles: {
          create: {
            roleId: 'student-role-id', // ID của role student trong DB
            isActive: true
          }
        }
      },
      include: {
        roles: true
      }
    });

    return user;
  }

  async login(data: LoginDTO) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { roles: true }
    });
  
    if (!user) throw new Error('User not found');
  
    const isValidPassword = await comparePassword(data.password, user.passwordHash);
    if (!isValidPassword) throw new Error('Invalid password');
  
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);
  
    return { accessToken, refreshToken };
  }
  

  async loginWithGoogle(idToken: string) {
    const googleClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload) throw new Error('Invalid Google token');

    let user = await prisma.user.findUnique({
      where: { email: payload.email }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email!,
          username: payload.email!.split('@')[0],
          fullName: payload.name,
          avatar: payload.picture,
          passwordHash: await hashPassword(Math.random().toString(36))
        }
      });
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);

    return { accessToken, refreshToken };
  }

  private generateAccessToken(user: any) {
    if (!process.env.JWT_SECRET_ACCESS_TOKEN) {
      throw new Error('JWT_SECRET_ACCESS_TOKEN is not defined');
    }
    return jwt.sign(
      {
        userId: user.id,
        roles: user.roles.map((r: any) => r.role.name),
      },
      process.env.JWT_SECRET_ACCESS_TOKEN,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m' }
    );
  }
  
  private async generateRefreshToken(user: any) {
    if (!process.env.JWT_SECRET_REFRESH_TOKEN) {
      throw new Error('JWT_SECRET_REFRESH_TOKEN is not defined');
    }
    
    
    const token = jwt.sign(
      {
        userId: user.id,
        roles: user.roles.map((r: any) => r.role.name),
      },
      process.env.JWT_SECRET_REFRESH_TOKEN,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '15m' }
    );

    await prisma.refreshToken.create({
      data: {
        token,
        userId : user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày
      },
    });
  
    return token;
  }
  
  async logout(refreshToken: string) {
    return prisma.refreshToken.delete({
      where: { token: refreshToken }
    });
  }

  async updateProfile(userId: string, data: {
    fullName?: string;
    avatar?: string;
  }) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        fullName: data.fullName,
        avatar: data.avatar,
        updatedAt: new Date()
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        avatar: true
      }
    });
  }

  // Thêm method để tạo các user mặc định
  async createDefaultUsers() {
    const roles = [
      'lecturer',
      'head_of_department', 
      'dean',
      'reviewer',
      'mentor'
    ];

    for (const role of roles) {
      await prisma.user.create({
        data: {
          email: `${role}@gmail.com`,
          username: '${role}' ,
          passwordHash: await hashPassword('12345'),
          fullName: role.charAt(0).toUpperCase() + role.slice(1),
          roles: {
            create: {
              roleId: `${role}-role-id`, // ID của role tương ứng
              isActive: true
            }
          }
        }
      });
    }
  }
}
