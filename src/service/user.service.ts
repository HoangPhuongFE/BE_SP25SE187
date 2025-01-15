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
    
    return prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: hashedPassword,
        fullName: data.fullName
      }
    });
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
      throw new Error('JWT_SECRET_ACCESS_TOKEN is not defined in the environment variables');
    }
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        roles: user.roles.map((r: any) => r.role.name),
      },
      process.env.JWT_SECRET_ACCESS_TOKEN,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m' }
    );
  }
  
  private async generateRefreshToken(userId: string) {
    // Tạo UUID
    const token = uuidv4();
  
    // Lưu token vào database
    await prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày
      },
    });
  
    return token; // Trả về token UUID
  }
  
}
