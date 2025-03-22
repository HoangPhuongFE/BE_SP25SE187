import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/hash';
import { ADMIN_MESSAGE } from '~/constants/message';

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

    // Kiểm tra semester tồn tại và chưa bị xóa
    if (data.semesterId) {
      const semester = await prisma.semester.findUnique({
        where: {
          id: data.semesterId,
          isDeleted: false
        }
      });
      
      if (!semester) {
        throw new Error('Học kỳ không tồn tại hoặc đã bị xóa');
      }
    }

    const semesterId = data.semesterId || SYSTEM_DEFAULT_SEMESTER_ID;

    return prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: hashedPassword,
        fullName: data.fullName,
        roles: {
          create: roleIds.map((role) => ({
            roleId: role.id,
            semesterId,
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

    // Kiểm tra semester tồn tại và chưa bị xóa
    if (data.semesterId) {
      const semester = await prisma.semester.findUnique({
        where: {
          id: data.semesterId,
          isDeleted: false
        }
      });
      
      if (!semester) {
        throw new Error('Học kỳ không tồn tại hoặc đã bị xóa');
      }
    }

    const semesterId = data.semesterId || SYSTEM_DEFAULT_SEMESTER_ID;

    await prisma.userRole.deleteMany({ where: { userId: data.userId } });

    await prisma.userRole.createMany({
      data: roleIds.map((role) => ({
        roleId: role.id,
        userId: data.userId,
        semesterId,
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

  async deleteUser(userId: string, deletedByUserId: string, ipAddress?: string): Promise<{ message: string; data: any }> {
    try {
      // Kiểm tra xem User có tồn tại và chưa bị đánh dấu xóa
      const existingUser = await prisma.user.findUnique({
        where: { id: userId, isDeleted: false },
      });
      if (!existingUser) {
        await prisma.systemLog.create({
          data: {
            userId: deletedByUserId,
            action: 'DELETE_USER_ATTEMPT',
            entityType: 'User',
            entityId: userId,
            description: 'Thử xóa người dùng nhưng không tìm thấy hoặc đã bị đánh dấu xóa',
            severity: 'WARNING',
            ipAddress: ipAddress || 'unknown',
          },
        });
        throw new Error('User không tồn tại');
      }
  
      // Xóa mềm trong transaction
      const updatedUser = await prisma.$transaction(async (tx) => {
        // 1. Đánh dấu xóa các UserRole liên quan
        await tx.userRole.updateMany({
          where: { userId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 2. Đánh dấu xóa các RefreshToken liên quan
        await tx.refreshToken.updateMany({
          where: { userId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 3. Đánh dấu xóa các Student liên quan
        await tx.student.updateMany({
          where: { userId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 4. Đánh dấu xóa các ImportLog liên quan
        await tx.importLog.updateMany({
          where: { importById: userId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 5. Đánh dấu xóa các SystemConfig liên quan
        await tx.systemConfig.updateMany({
          where: { updatedBy: userId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 6. Đánh dấu xóa các Topic liên quan (createdTopics và supervisedTopics)
        await tx.topic.updateMany({
          where: {
            OR: [
              { createdBy: userId },
              { subSupervisor: userId },
              { mainSupervisor: userId },
            ],
            isDeleted: false,
          },
          data: { isDeleted: true },
        });
  
        // 7. Đánh dấu xóa các Group liên quan (createdGroups)
        await tx.group.updateMany({
          where: { createdBy: userId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 8. Đánh dấu xóa các SystemLog liên quan
        await tx.systemLog.updateMany({
          where: { userId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 9. Đánh dấu xóa các EmailLog liên quan
        await tx.emailLog.updateMany({
          where: { userId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 10. Đánh dấu xóa các Document liên quan
        await tx.document.updateMany({
          where: { uploadedBy: userId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 11. Đánh dấu xóa các NotificationRecipient liên quan
        await tx.notificationRecipient.updateMany({
          where: { userId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 12. Đánh dấu xóa các EmailTemplate liên quan
        await tx.emailTemplate.updateMany({
          where: { createdBy: userId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 13. Đánh dấu xóa các GroupMember liên quan
        await tx.groupMember.updateMany({
          where: { userId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 14. Đánh dấu xóa các GroupMentor liên quan (MentorGroupRelation và AddedByUserRelation)
        await tx.groupMentor.updateMany({
          where: {
            OR: [
              { mentorId: userId },
              { addedBy: userId },
            ],
            isDeleted: false,
          },
          data: { isDeleted: true },
        });
  
        // 15. Đánh dấu xóa các CouncilMember liên quan
        await tx.councilMember.updateMany({
          where: { userId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 16. Đánh dấu xóa các SubmissionPeriod liên quan
        await tx.submissionPeriod.updateMany({
          where: { createdBy: userId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 17. Đánh dấu xóa các ProgressReportMentor liên quan
        await tx.progressReportMentor.updateMany({
          where: { mentorId: userId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 18. Đánh dấu xóa các Decision liên quan
        await tx.decision.updateMany({
          where: { createdBy: userId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 19. Đánh dấu xóa các ReviewAssignment liên quan
        await tx.reviewAssignment.updateMany({
          where: { reviewerId: userId, isDeleted: false },
          data: { isDeleted: true },
        });
  
        // 20. Đánh dấu xóa User
        await tx.user.update({
          where: { id: userId },
          data: { isDeleted: true },
        });
  
        // 21. Ghi log hành động thành công
        await tx.systemLog.create({
          data: {
            userId: deletedByUserId,
            action: 'DELETE_USER',
            entityType: 'User',
            entityId: userId,
            description: `Người dùng "${existingUser.username}" đã được đánh dấu xóa bởi admin`,
            severity: 'INFO',
            ipAddress: ipAddress || 'unknown',
            metadata: {
              deletedBy: deletedByUserId,
              username: existingUser.username,
              email: existingUser.email,
            },
            oldValues: JSON.stringify(existingUser),
          },
        });
  
        // Trả về dữ liệu User sau khi cập nhật
        return await tx.user.findUnique({
          where: { id: userId },
        });
      });
  
      return { message: ADMIN_MESSAGE.DELETE_USER_SUCCESS, data: updatedUser };
    } catch (error) {
      await prisma.systemLog.create({
        data: {
          userId: deletedByUserId,
          action: 'DELETE_USER_ERROR',
          entityType: 'User',
          entityId: userId,
          description: 'Lỗi hệ thống khi đánh dấu xóa người dùng',
          severity: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
          stackTrace: (error as Error).stack || 'No stack trace',
          ipAddress: ipAddress || 'unknown',
        },
      });
      throw error;
    }
  }

  async getUsers() {
    return prisma.user.findMany({
      where: {
        isDeleted: false
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        roles: { 
          where: {
            isDeleted: false,
            semester: {
              isDeleted: false
            }
          },
          select: { 
            role: true,
            semester: {
              select: {
                id: true,
                code: true
              }
            }
          } 
        },
      },
    });
  }

  async getUserById(userId: string) {
    return prisma.user.findUnique({
        where: { 
            id: userId,
            isDeleted: false
        },
        include: { 
            roles: { 
                where: {
                    isDeleted: false,
                    semester: {
                        isDeleted: false
                    }
                },
                include: { 
                    role: true,
                    semester: {
                        select: {
                            id: true,
                            code: true
                        }
                    }
                } 
            } 
        },
    });
  }
}