// services/semester-role.service.ts
import { PrismaClient } from '@prisma/client';
import HTTP_STATUS from '../constants/httpStatus';

const prisma = new PrismaClient();

export interface FlexibleRoleIdentifier {
  userId?: string;
  userEmail?: string;
  roleId?: string;
  roleName?: string;
  semesterId?: string;
  semesterCode?: string;
}

export class SemesterRoleService {
 
  async createSemesterRole(data: FlexibleRoleIdentifier & { isActive?: boolean }) {
    try {
      // Resolve user
      let finalUserId = data.userId;
      if (!finalUserId) {
        if (!data.userEmail) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: 'Thiếu thông tin userId hoặc userEmail!',
          };
        }
        const user = await prisma.user.findUnique({
          where: { email: data.userEmail },
          select: { id: true },
        });
        if (!user) {
          return {
            success: false,
            status: HTTP_STATUS.NOT_FOUND,
            message: 'Không tìm thấy người dùng với email được cung cấp!',
          };
        }
        finalUserId = user.id;
      }

      // Resolve role
      let finalRoleId = data.roleId;
      if (!finalRoleId) {
        if (!data.roleName) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: 'Thiếu thông tin roleId hoặc roleName!',
          };
        }
        const role = await prisma.role.findUnique({
          where: { name: data.roleName },
          select: { id: true },
        });
        if (!role) {
          return {
            success: false,
            status: HTTP_STATUS.NOT_FOUND,
            message: 'Không tìm thấy role với tên được cung cấp!',
          };
        }
        finalRoleId = role.id;
      }

      // Resolve semester
      let finalSemesterId = data.semesterId;
      if (!finalSemesterId) {
        if (!data.semesterCode) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: 'Thiếu thông tin semesterId hoặc semesterCode!',
          };
        }
        const semester = await prisma.semester.findFirst({
          where: { code: data.semesterCode },
          select: { id: true },
        });
        if (!semester) {
          return {
            success: false,
            status: HTTP_STATUS.NOT_FOUND,
            message: 'Không tìm thấy học kỳ với mã được cung cấp!',
          };
        }
        finalSemesterId = semester.id;
      }

      // Kiểm tra xem phân công đã tồn tại hay chưa
      const exists = await prisma.userRole.findUnique({
        where: {
          userId_roleId_semesterId: {
            userId: finalUserId,
            roleId: finalRoleId,
            semesterId: finalSemesterId,
          },
        },
      });
      if (exists) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: 'Phân công vai trò cho học kỳ này đã tồn tại!',
        };
      }

      const newAssignment = await prisma.userRole.create({
        data: {
          userId: finalUserId,
          roleId: finalRoleId,
          semesterId: finalSemesterId,
          isActive: data.isActive ?? true,
        },
      });
      return { success: true, status: HTTP_STATUS.CREATED, message: 'Tạo phân công vai trò học kỳ thành công!', data: newAssignment };
    } catch (error) {
      console.error("Error in createSemesterRole:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống khi tạo vai trò học kỳ!",
      };
    }
  }

  
  private async resolveIdentifiers(input: FlexibleRoleIdentifier): Promise<{ userId: string; roleId: string; semesterId: string } | { error: string }> {
    let finalUserId = input.userId;
    if (!finalUserId) {
      if (!input.userEmail) return { error: 'Thiếu thông tin userId hoặc userEmail' };
      const user = await prisma.user.findUnique({
        where: { email: input.userEmail },
        select: { id: true },
      });
      if (!user) return { error: 'Không tìm thấy người dùng với email được cung cấp' };
      finalUserId = user.id;
    }

    let finalRoleId = input.roleId;
    if (!finalRoleId) {
      if (!input.roleName) return { error: 'Thiếu thông tin roleId hoặc roleName' };
      const role = await prisma.role.findUnique({
        where: { name: input.roleName },
        select: { id: true },
      });
      if (!role) return { error: 'Không tìm thấy role với tên được cung cấp' };
      finalRoleId = role.id;
    }

    let finalSemesterId = input.semesterId;
    if (!finalSemesterId) {
      if (!input.semesterCode) return { error: 'Thiếu thông tin semesterId hoặc semesterCode' };
      const semester = await prisma.semester.findFirst({
        where: { code: input.semesterCode },
        select: { id: true },
      });
      if (!semester) return { error: 'Không tìm thấy học kỳ với mã được cung cấp' };
      finalSemesterId = semester.id;
    }

    return { userId: finalUserId, roleId: finalRoleId, semesterId: finalSemesterId };
  }


  async updateSemesterRoleFlexible(input: FlexibleRoleIdentifier, data: { isActive?: boolean }): Promise<any> {
    try {
      const resolved = await this.resolveIdentifiers(input);
      if ('error' in resolved) {
        return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: resolved.error };
      }
      const { userId, roleId, semesterId } = resolved;
      const updatedAssignment = await prisma.userRole.update({
        where: { userId_roleId_semesterId: { userId, roleId, semesterId } },
        data: data,
      });
      return { success: true, status: HTTP_STATUS.OK, data: updatedAssignment };
    } catch (error) {
      console.error("Error in updateSemesterRoleFlexible:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống khi cập nhật vai trò học kỳ!" };
    }
  }


  async deleteSemesterRoleFlexible(input: FlexibleRoleIdentifier): Promise<any> {
    try {
      const resolved = await this.resolveIdentifiers(input);
      if ('error' in resolved) {
        return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: resolved.error };
      }
      const { userId, roleId, semesterId } = resolved;
      await prisma.userRole.delete({
        where: { userId_roleId_semesterId: { userId, roleId, semesterId } },
      });
      return { success: true, status: HTTP_STATUS.OK, message: "Xóa vai trò học kỳ thành công!" };
    } catch (error) {
      console.error("Error in deleteSemesterRoleFlexible:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống khi xóa vai trò học kỳ!" };
    }
  }

 
  async getRolesBySemester(semesterId: string) {
    try {
      const roles = await prisma.userRole.findMany({
        where: { semesterId },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          role: { select: { id: true, name: true, description: true } },
        },
      });
      return { success: true, status: HTTP_STATUS.OK, data: roles };
    } catch (error) {
      console.error("Error in getRolesBySemester:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
    }
  }
}
