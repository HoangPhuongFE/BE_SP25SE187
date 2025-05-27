import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/hash';
import { Prisma } from '@prisma/client';
const prisma = new PrismaClient();
interface CreateUserDTO {
  email: string;
  username: string;
  password: string;
  fullName?: string;
  roles: string[];
  semesterId?: string;
  studentCode?: string;
  majorId?: string;
  specializationId?: string;
}

interface UpdateRolesDTO {
  userId: string;
  roles: string[];
  semesterId?: string;
}
interface UserWithDetails {
  id: string;
  email: string;
  username: string;
  fullName?: string | null;
  roles: { role: { name: string } }[];
  studentCode?: string | null;
  majorId?: string | null;
  semesterId?: string | null;
}

interface DeleteUserResponse {
  message: string;
  data: { id: string; email: string; username: string; fullName?: string | null };
}
export class AdminService {
  async createUser(data: CreateUserDTO) {
    // Kiểm tra email đã tồn tại
    const existingEmail = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingEmail) {
      throw new Error('Email đã tồn tại');
    }

    // Băm mật khẩu (nếu có, tùy thuộc vào Google login)
    const hashedPassword = data.password ? await hashPassword(data.password) : null;

    // Xác thực vai trò
    const roleIds = await prisma.role.findMany({
      where: { name: { in: data.roles }, isDeleted: false },
      select: { id: true },
    });
    if (!roleIds.length) {
      throw new Error('Không tìm thấy vai trò hợp lệ');
    }

    // Xác thực học kỳ
    let semester = null;
    if (data.semesterId) {
      semester = await prisma.semester.findUnique({
        where: { id: data.semesterId, isDeleted: false },
      });
      if (!semester) {
        throw new Error('Học kỳ không tồn tại hoặc đã bị xóa');
      }
    }

    // Giao dịch tạo người dùng
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          username: data.username.toLowerCase(),
          passwordHash: hashedPassword ?? '',
          fullName: data.fullName,
          roles: {
            create: roleIds.map((role) => ({
              roleId: role.id,
              semesterId: data.semesterId || undefined,
              isActive: true,
            })),
          },
        },
        include: {
          roles: { include: { role: true } },
        },
      });

      let student = null;
      let semesterStudent = null;
      if (data.roles.includes('student') && data.semesterId) {
        if (!data.studentCode || !data.majorId) {
          throw new Error('Mã sinh viên và ID ngành học là bắt buộc');
        }

        const major = await tx.major.findUnique({
          where: { id: data.majorId, isDeleted: false },
        });
        if (!major) {
          throw new Error('Ngành học không tồn tại hoặc đã bị xóa');
        }

        student = await tx.student.create({
          data: {
            userId: user.id,
            studentCode: data.studentCode,
            majorId: data.majorId,
            specializationId: data.specializationId || undefined,
            importSource: 'manual',
            isImported: false,
          },
        });

        semesterStudent = await tx.semesterStudent.create({
          data: {
            semesterId: data.semesterId,
            studentId: student.id,
            status: 'PENDING',
            isEligible: false,
            qualificationStatus: 'not qualified',
          },
        });
      }

      return {
        ...user,
        studentCode: student ? student.studentCode : null,
        majorId: student ? student.majorId : null,
        semesterId: semesterStudent ? semesterStudent.semesterId : null,
      };
    });
  }







  async updateUserRoles(data: UpdateRolesDTO): Promise<UserWithDetails> {
    // Kiểm tra người dùng tồn tại
    const userExists = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!userExists) throw new Error('Người dùng không tồn tại');

    // Kiểm tra vai trò hợp lệ
    const roleIds = await prisma.role.findMany({
      where: { name: { in: data.roles }, isDeleted: false },
      select: { id: true, isSystemWide: true },
    });
    if (roleIds.length === 0) throw new Error('Không tìm thấy vai trò hợp lệ');

    // Kiểm tra học kỳ nếu cần
    let semester = null;
    const requiresSemester = data.roles.includes('student');
    if (requiresSemester && !data.semesterId) {
      throw new Error('Vai trò student yêu cầu semesterId');
    }
    if (data.semesterId) {
      semester = await prisma.semester.findUnique({
        where: { id: data.semesterId, isDeleted: false },
      });
      if (!semester) throw new Error('Học kỳ không tồn tại hoặc đã bị xóa');
    }

    // Giao dịch cập nhật vai trò
    return prisma.$transaction(async (tx) => {
      // Xóa vai trò hiện tại
      await tx.userRole.deleteMany({
        where: {
          userId: data.userId,
          ...(data.semesterId ? { semesterId: data.semesterId } : { semesterId: null }),
        },
      });

      // Thêm vai trò mới
      await tx.userRole.createMany({
        data: roleIds.map((role) => ({
          roleId: role.id,
          userId: data.userId,
          semesterId: role.isSystemWide ? null : data.semesterId || null,
          isActive: true,
        })),
      });

      // Lấy thông tin người dùng và sinh viên
      const updatedUser = await tx.user.findUnique({
        where: { id: data.userId },
        include: {
          roles: { include: { role: true } },
          students: {
            include: {
              semesterStudents: data.semesterId
                ? { where: { semesterId: data.semesterId } }
                : false,
            },
          },
        },
      });

      if (!updatedUser) throw new Error('Không tìm thấy người dùng sau khi cập nhật');

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        fullName: updatedUser.fullName,
        roles: updatedUser.roles,
        studentCode: updatedUser.students?.[0]?.studentCode || null,
        majorId: updatedUser.students?.[0]?.majorId || null,
        semesterId: updatedUser.students?.[0]?.semesterStudents?.[0]?.semesterId || null,
      };
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








  async deleteUser(userId: string, deletedByUserId: string, semesterId?: string): Promise<DeleteUserResponse> {
    console.log('deleteUser called with:', { userId, deletedByUserId, semesterId });

    // Kiểm tra quyền admin
    const admin = await prisma.user.findFirst({
      where: { id: deletedByUserId, roles: { some: { role: { name: 'admin' }, isDeleted: false } } },
    });
    if (!admin) throw new Error('Không có quyền xóa người dùng');

    // Kiểm tra người dùng tồn tại
    const existingUser = await prisma.user.findUnique({
      where: { id: userId, isDeleted: false },
      include: { roles: { include: { role: true } } },
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
          ipAddress: 'unknown',
        },
      });
      throw new Error('Người dùng không tồn tại');
    }

    // Chặn xóa vai trò đặc biệt
    const protectedRoles = ['admin', 'graduation_thesis_manager', 'academic_officer', 'examination_officer'];
    const userRoles = existingUser.roles.map((ur) => ur.role.name);
    if (userRoles.some((role) => protectedRoles.includes(role))) {
      await prisma.systemLog.create({
        data: {
          userId: deletedByUserId,
          action: 'DELETE_USER_ATTEMPT',
          entityType: 'User',
          entityId: userId,
          description: `Thử xóa người dùng với vai trò đặc biệt: ${userRoles.join(', ')}`,
          severity: 'ERROR',
          ipAddress: 'unknown',
        },
      });
      throw new Error('Không thể xóa người dùng có vai trò đặc biệt');
    }

    // Kiểm tra học kỳ nếu có
    // Kiểm tra học kỳ nếu có
    let semester = null;
    let semesterCode = null; // Thêm biến để lưu code
    if (semesterId) {
      semester = await prisma.semester.findUnique({
        where: { id: semesterId, isDeleted: false },
        select: { id: true, code: true }, // Lấy thêm code
      });
      if (!semester) throw new Error('Học kỳ không tồn tại hoặc đã bị xóa');
      semesterCode = semester.code; // Gán code
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      // Lấy studentIds liên quan
      const students = await tx.student.findMany({
        where: { userId, isDeleted: false },
        select: { id: true },
      });
      const studentIds = students.map((s) => s.id);

      if (semesterId) {
        // Xóa SemesterStudent trong học kỳ
        await tx.semesterStudent.updateMany({
          where: { studentId: { in: studentIds }, semesterId, isDeleted: false },
          data: { isDeleted: true },
        });

        // Xóa UserRole trong học kỳ
        await tx.userRole.updateMany({
          where: { userId, semesterId, isDeleted: false },
          data: { isDeleted: true },
        });

        // Xóa Group và dữ liệu liên quan trong học kỳ
        const groups = await tx.group.findMany({
          where: { semesterId, isDeleted: false },
          select: { id: true },
        });
        const groupIds = groups.map((g) => g.id);

        if (groupIds.length > 0) {
          const defenseSchedules = await tx.defenseSchedule.findMany({
            where: { groupId: { in: groupIds }, isDeleted: false },
            select: { id: true },
          });
          const defenseScheduleIds = defenseSchedules.map((ds) => ds.id);

          const meetingSchedules = await tx.meetingSchedule.findMany({
            where: { groupId: { in: groupIds }, isDeleted: false },
            select: { id: true },
          });
          const meetingScheduleIds = meetingSchedules.map((ms) => ms.id);

          await Promise.all([
            tx.reviewSchedule.updateMany({
              where: { groupId: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.defenseSchedule.updateMany({
              where: { groupId: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.defenseMemberResult.updateMany({
              where: { defenseScheduleId: { in: defenseScheduleIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.progressReport.updateMany({
              where: { groupId: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.meetingSchedule.updateMany({
              where: { groupId: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.feedback.updateMany({
              where: { meetingId: { in: meetingScheduleIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.groupMember.updateMany({
              where: { groupId: { in: groupIds }, userId, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.groupMentor.updateMany({
              where: { groupId: { in: groupIds }, OR: [{ mentorId: userId }, { addedBy: userId }], isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.group.updateMany({
              where: { id: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
          ]);
        }

        // Xóa Topic trong học kỳ
        const topicsInGroups = await tx.topic.findMany({
          where: { proposedGroupId: { in: groupIds }, semesterId, isDeleted: false },
          select: { id: true },
        });
        const topicIdsFromGroups = topicsInGroups.map((t) => t.id);

        if (topicIdsFromGroups.length > 0) {
          await Promise.all([
            tx.topicAssignment.updateMany({
              where: { topicId: { in: topicIdsFromGroups }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.document.updateMany({
              where: { topicId: { in: topicIdsFromGroups }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.topic.updateMany({
              where: { id: { in: topicIdsFromGroups }, isDeleted: false },
              data: { isDeleted: true },
            }),
          ]);
        }

        // Xóa TopicRegistration trong học kỳ
        await tx.topicRegistration.updateMany({
          where: { userId, topic: { semesterId }, isDeleted: false },
          data: { isDeleted: true },
        });

        // Kiểm tra và xóa Student nếu không còn liên kết học kỳ
        for (const studentId of studentIds) {
          const remainingSemesterStudents = await tx.semesterStudent.findMany({
            where: { studentId, isDeleted: false },
          });
          if (remainingSemesterStudents.length === 0) {
            await tx.student.updateMany({
              where: { id: studentId, isDeleted: false },
              data: { isDeleted: true },
            });
          }
        }
      } else {
        // Xóa toàn bộ dữ liệu liên quan
        const groupMembers = await tx.groupMember.findMany({
          where: { userId, isDeleted: false },
          select: { groupId: true },
        });
        const groupMentors = await tx.groupMentor.findMany({
          where: { OR: [{ mentorId: userId }, { addedBy: userId }], isDeleted: false },
          select: { groupId: true },
        });
        const groupIds = [...new Set([...groupMembers.map((gm) => gm.groupId), ...groupMentors.map((gm) => gm.groupId)])];

        if (groupIds.length > 0) {
          const defenseSchedules = await tx.defenseSchedule.findMany({
            where: { groupId: { in: groupIds }, isDeleted: false },
            select: { id: true },
          });
          const defenseScheduleIds = defenseSchedules.map((ds) => ds.id);

          const meetingSchedules = await tx.meetingSchedule.findMany({
            where: { groupId: { in: groupIds }, isDeleted: false },
            select: { id: true },
          });
          const meetingScheduleIds = meetingSchedules.map((ms) => ms.id);

          await Promise.all([
            tx.reviewSchedule.updateMany({
              where: { groupId: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.defenseSchedule.updateMany({
              where: { groupId: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.defenseMemberResult.updateMany({
              where: { defenseScheduleId: { in: defenseScheduleIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.progressReport.updateMany({
              where: { groupId: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.meetingSchedule.updateMany({
              where: { groupId: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.feedback.updateMany({
              where: { meetingId: { in: meetingScheduleIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
          ]);
        }

        const topicsInGroups = await tx.topic.findMany({
          where: { proposedGroupId: { in: groupIds }, isDeleted: false },
          select: { id: true },
        });
        const topicIdsFromGroups = topicsInGroups.map((t) => t.id);

        if (topicIdsFromGroups.length > 0) {
          await Promise.all([
            tx.topicAssignment.updateMany({
              where: { topicId: { in: topicIdsFromGroups }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.document.updateMany({
              where: { topicId: { in: topicIdsFromGroups }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.topic.updateMany({
              where: { id: { in: topicIdsFromGroups }, isDeleted: false },
              data: { isDeleted: true },
            }),
          ]);
        }

        if (groupIds.length > 0) {
          await Promise.all([
            tx.groupMember.updateMany({
              where: { groupId: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.groupMentor.updateMany({
              where: { groupId: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.group.updateMany({
              where: { id: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
          ]);
        }

        const topics = await tx.topic.findMany({
          where: {
            OR: [{ createdBy: userId }, { subSupervisor: userId }, { mainSupervisor: userId }],
            isDeleted: false,
          },
          select: { id: true },
        });
        const topicIds = topics.map((t) => t.id);

        if (topicIds.length > 0) {
          await Promise.all([
            tx.topicAssignment.updateMany({
              where: { topicId: { in: topicIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.document.updateMany({
              where: { topicId: { in: topicIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.topic.updateMany({
              where: { id: { in: topicIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
          ]);
        }

        await Promise.all([
          tx.userRole.updateMany({ where: { userId, isDeleted: false }, data: { isDeleted: true } }),
          tx.refreshToken.updateMany({ where: { userId, isDeleted: false }, data: { isDeleted: true } }),
          tx.student.updateMany({ where: { userId, isDeleted: false }, data: { isDeleted: true } }),
          tx.semesterStudent.updateMany({
            where: { studentId: { in: studentIds }, isDeleted: false },
            data: { isDeleted: true },
          }),
          tx.importLog.updateMany({ where: { importById: userId, isDeleted: false }, data: { isDeleted: true } }),
          tx.systemConfig.updateMany({ where: { updatedBy: userId, isDeleted: false }, data: { isDeleted: true } }),
          tx.systemLog.updateMany({ where: { userId, isDeleted: false }, data: { isDeleted: true } }),
          tx.emailLog.updateMany({ where: { userId, isDeleted: false }, data: { isDeleted: true } }),
          tx.document.updateMany({ where: { uploadedBy: userId, isDeleted: false }, data: { isDeleted: true } }),
          tx.notificationRecipient.updateMany({ where: { userId, isDeleted: false }, data: { isDeleted: true } }),
          tx.emailTemplate.updateMany({ where: { createdBy: userId, isDeleted: false }, data: { isDeleted: true } }),
          tx.groupMember.updateMany({ where: { userId, isDeleted: false }, data: { isDeleted: true } }),
          tx.groupMentor.updateMany({
            where: { OR: [{ mentorId: userId }, { addedBy: userId }], isDeleted: false },
            data: { isDeleted: true },
          }),
          tx.councilMember.updateMany({ where: { userId, isDeleted: false }, data: { isDeleted: true } }),
          tx.submissionPeriod.updateMany({ where: { createdBy: userId, isDeleted: false }, data: { isDeleted: true } }),
          tx.progressReportMentor.updateMany({ where: { mentorId: userId, isDeleted: false }, data: { isDeleted: true } }),
          tx.decision.updateMany({ where: { createdBy: userId, isDeleted: false }, data: { isDeleted: true } }),
          tx.reviewAssignment.updateMany({ where: { reviewerId: userId, isDeleted: false }, data: { isDeleted: true } }),
          tx.topicRegistration.updateMany({
            where: { OR: [{ userId }, { reviewerId: userId }], isDeleted: false },
            data: { isDeleted: true },
          }),
          tx.aIVerificationLog.updateMany({
            where: { verifiedBy: userId, isDeleted: false },
            data: { isDeleted: true },
          }),
        ]);
      }

      // Xóa user nếu không còn vai trò hoặc dữ liệu liên quan
      const remainingRoles = await tx.userRole.findMany({
        where: { userId, isDeleted: false },
      });
      const remainingSemesterStudents = await tx.semesterStudent.findMany({
        where: { student: { userId }, isDeleted: false },
      });
      if (remainingRoles.length === 0 && remainingSemesterStudents.length === 0) {
        await tx.user.update({
          where: { id: userId },
          data: { isDeleted: true },
        });
      }

      // Ghi log
      await tx.systemLog.create({
        data: {
          userId: deletedByUserId,
          action: 'DELETE_USER',
          entityType: 'User',
          entityId: userId,
          description: `Người dùng "${existingUser.username}" (${existingUser.email}) đã được đánh dấu xóa ${semesterId ? `trong học kỳ ${semesterCode}` : 'toàn bộ'} bởi admin`,
          severity: 'INFO',
          ipAddress: 'unknown',
          metadata: {
            deletedBy: deletedByUserId,
            username: existingUser.username,
            email: existingUser.email,
            semesterId: semesterId || null,
            semesterCode: semesterCode || null, // Thêm semesterCode vào metadata
          },
          oldValues: JSON.stringify({
            id: existingUser.id,
            username: existingUser.username,
            email: existingUser.email,
            fullName: existingUser.fullName,
          }),
        },
      });

      return { id: existingUser.id, email: existingUser.email, username: existingUser.username, fullName: existingUser.fullName };
    });

    return { message: `Xóa mềm người dùng và các dữ liệu liên quan ${semesterId ? `trong học kỳ ${semesterCode}` : 'toàn bộ'} thành công!`, data: updatedUser };
  }

  async getUsers(semesterId?: string) {
    const adminRoles = ['graduation_thesis_manager', 'examination_officer', 'academic_officer'];

    return prisma.user.findMany({
      where: {
        isDeleted: false,
        OR: [
          // Users with admin roles (not filtered by semesterId)
          {
            roles: {
              some: {
                role: {
                  name: { in: adminRoles },
                },
                isDeleted: false,
              },
            },
          },
          // Users with other roles filtered by semesterId (if provided)
          {
            ...(semesterId && {
              roles: {
                some: {
                  semesterId,
                  isDeleted: false,
                  semester: {
                    isDeleted: false,
                  },
                },
              },
            }),
          },
        ],
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
              isDeleted: false,
            },
            // Only apply semesterId filter for non-admin roles
            OR: [
              {
                role: {
                  name: { notIn: adminRoles },
                },
                ...(semesterId && { semesterId }),
              },
              {
                role: {
                  name: { in: adminRoles },
                },
              },
            ],
          },
          select: {
            role: true,
            semester: {
              select: {
                id: true,
                code: true,
              },
            },
          },
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
  async deleteAllUsers(deletedByUserId: string, semesterId?: string): Promise<{ message: string }> {
    console.log('deleteAllUsers called with:', { deletedByUserId, semesterId });

    // Kiểm tra quyền admin
    const admin = await prisma.user.findFirst({
      where: { id: deletedByUserId, roles: { some: { role: { name: 'admin' }, isDeleted: false } } },
    });
    console.log('Admin check:', admin);
    if (!admin) throw new Error('Không có quyền xóa tất cả người dùng');

    // Kiểm tra học kỳ nếu có và lấy code
    let semester = null;
    let semesterCode = null;
    if (semesterId) {
      semester = await prisma.semester.findUnique({
        where: { id: semesterId, isDeleted: false },
        select: { id: true, code: true }, // Lấy code
      });
      if (!semester) throw new Error('Học kỳ không tồn tại hoặc đã bị xóa');
      semesterCode = semester.code;
    }

    return prisma.$transaction(async (tx) => {
      // Lấy userIds, loại trừ vai trò đặc biệt
      const protectedRoles = ['admin', 'graduation_thesis_manager', 'academic_officer', 'examination_officer'];
      const users = await tx.user.findMany({
        where: {
          isDeleted: false,
          roles: { none: { role: { name: { in: protectedRoles } } } },
        },
        select: { id: true },
      });
      const userIds = users.map((u) => u.id);
      console.log('Users to delete:', userIds);

      if (userIds.length === 0) {
        return { message: 'Không có người dùng nào để xóa.' };
      }

      if (semesterId) {
        // Xóa dữ liệu trong học kỳ
        const students = await tx.student.findMany({
          where: { userId: { in: userIds }, isDeleted: false },
          select: { id: true },
        });
        const studentIds = students.map((s) => s.id);

        await tx.semesterStudent.updateMany({
          where: { studentId: { in: studentIds }, semesterId, isDeleted: false },
          data: { isDeleted: true },
        });

        await tx.userRole.updateMany({
          where: { userId: { in: userIds }, semesterId, isDeleted: false },
          data: { isDeleted: true },
        });

        const groups = await tx.group.findMany({
          where: { semesterId, isDeleted: false },
          select: { id: true },
        });
        const groupIds = groups.map((g) => g.id);

        if (groupIds.length > 0) {
          const defenseSchedules = await tx.defenseSchedule.findMany({
            where: { groupId: { in: groupIds }, isDeleted: false },
            select: { id: true },
          });
          const defenseScheduleIds = defenseSchedules.map((ds) => ds.id);

          const meetingSchedules = await tx.meetingSchedule.findMany({
            where: { groupId: { in: groupIds }, isDeleted: false },
            select: { id: true },
          });
          const meetingScheduleIds = meetingSchedules.map((ms) => ms.id);

          await Promise.all([
            tx.reviewSchedule.updateMany({
              where: { groupId: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.defenseSchedule.updateMany({
              where: { groupId: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.defenseMemberResult.updateMany({
              where: { defenseScheduleId: { in: defenseScheduleIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.progressReport.updateMany({
              where: { groupId: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.meetingSchedule.updateMany({
              where: { groupId: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.feedback.updateMany({
              where: { meetingId: { in: meetingScheduleIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.groupMember.updateMany({
              where: { groupId: { in: groupIds }, userId: { in: userIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.groupMentor.updateMany({
              where: { groupId: { in: groupIds }, OR: [{ mentorId: { in: userIds } }, { addedBy: { in: userIds } }], isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.group.updateMany({
              where: { id: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
          ]);
        }

        const topicsInGroups = await tx.topic.findMany({
          where: { proposedGroupId: { in: groupIds }, semesterId, isDeleted: false },
          select: { id: true },
        });
        const topicIdsFromGroups = topicsInGroups.map((t) => t.id);

        if (topicIdsFromGroups.length > 0) {
          await Promise.all([
            tx.topicAssignment.updateMany({
              where: { topicId: { in: topicIdsFromGroups }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.document.updateMany({
              where: { topicId: { in: topicIdsFromGroups }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.topic.updateMany({
              where: { id: { in: topicIdsFromGroups }, isDeleted: false },
              data: { isDeleted: true },
            }),
          ]);
        }

        await tx.topicRegistration.updateMany({
          where: { userId: { in: userIds }, topic: { semesterId }, isDeleted: false },
          data: { isDeleted: true },
        });

        // Xóa Student nếu không còn học kỳ
        for (const studentId of studentIds) {
          const remainingSemesterStudents = await tx.semesterStudent.findMany({
            where: { studentId, isDeleted: false },
          });
          if (remainingSemesterStudents.length === 0) {
            await tx.student.updateMany({
              where: { id: studentId, isDeleted: false },
              data: { isDeleted: true },
            });
          }
        }

        // Xóa User nếu không còn vai trò hoặc học kỳ
        for (const userId of userIds) {
          const remainingRoles = await tx.userRole.findMany({
            where: { userId, isDeleted: false },
          });
          const remainingSemesterStudents = await tx.semesterStudent.findMany({
            where: { student: { userId }, isDeleted: false },
          });
          if (remainingRoles.length === 0 && remainingSemesterStudents.length === 0) {
            await tx.user.update({
              where: { id: userId },
              data: { isDeleted: true },
            });
          }
        }
      } else {
        // Xóa toàn bộ dữ liệu
        const students = await tx.student.findMany({
          where: { userId: { in: userIds }, isDeleted: false },
          select: { id: true },
        });
        const studentIds = students.map((s) => s.id);

        const groupMembers = await tx.groupMember.findMany({
          where: { userId: { in: userIds }, isDeleted: false },
          select: { groupId: true },
        });
        const groupMentors = await tx.groupMentor.findMany({
          where: { OR: [{ mentorId: { in: userIds } }, { addedBy: { in: userIds } }], isDeleted: false },
          select: { groupId: true },
        });
        const groupIds = [...new Set([...groupMembers.map((gm) => gm.groupId), ...groupMentors.map((gm) => gm.groupId)])];

        if (groupIds.length > 0) {
          const defenseSchedules = await tx.defenseSchedule.findMany({
            where: { groupId: { in: groupIds }, isDeleted: false },
            select: { id: true },
          });
          const defenseScheduleIds = defenseSchedules.map((ds) => ds.id);

          const meetingSchedules = await tx.meetingSchedule.findMany({
            where: { groupId: { in: groupIds }, isDeleted: false },
            select: { id: true },
          });
          const meetingScheduleIds = meetingSchedules.map((ms) => ms.id);

          await Promise.all([
            tx.reviewSchedule.updateMany({
              where: { groupId: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.defenseSchedule.updateMany({
              where: { groupId: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.defenseMemberResult.updateMany({
              where: { defenseScheduleId: { in: defenseScheduleIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.progressReport.updateMany({
              where: { groupId: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.meetingSchedule.updateMany({
              where: { groupId: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.feedback.updateMany({
              where: { meetingId: { in: meetingScheduleIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
          ]);
        }

        const topicsInGroups = await tx.topic.findMany({
          where: { proposedGroupId: { in: groupIds }, isDeleted: false },
          select: { id: true },
        });
        const topicIdsFromGroups = topicsInGroups.map((t) => t.id);

        if (topicIdsFromGroups.length > 0) {
          await Promise.all([
            tx.topicAssignment.updateMany({
              where: { topicId: { in: topicIdsFromGroups }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.document.updateMany({
              where: { topicId: { in: topicIdsFromGroups }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.topic.updateMany({
              where: { id: { in: topicIdsFromGroups }, isDeleted: false },
              data: { isDeleted: true },
            }),
          ]);
        }

        if (groupIds.length > 0) {
          await Promise.all([
            tx.groupMember.updateMany({
              where: { groupId: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.groupMentor.updateMany({
              where: { groupId: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.group.updateMany({
              where: { id: { in: groupIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
          ]);
        }

        const topics = await tx.topic.findMany({
          where: {
            OR: [{ createdBy: { in: userIds } }, { subSupervisor: { in: userIds } }, { mainSupervisor: { in: userIds } }],
            isDeleted: false,
          },
          select: { id: true },
        });
        const topicIds = topics.map((t) => t.id);

        if (topicIds.length > 0) {
          await Promise.all([
            tx.topicAssignment.updateMany({
              where: { topicId: { in: topicIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.document.updateMany({
              where: { topicId: { in: topicIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
            tx.topic.updateMany({
              where: { id: { in: topicIds }, isDeleted: false },
              data: { isDeleted: true },
            }),
          ]);
        }

        // Xóa toàn bộ dữ liệu liên quan
        await Promise.all([
          tx.userRole.updateMany({ where: { userId: { in: userIds }, isDeleted: false }, data: { isDeleted: true } }),
          tx.refreshToken.updateMany({ where: { userId: { in: userIds }, isDeleted: false }, data: { isDeleted: true } }),
          tx.student.updateMany({ where: { userId: { in: userIds }, isDeleted: false }, data: { isDeleted: true } }),
          tx.semesterStudent.updateMany({
            where: { studentId: { in: studentIds }, isDeleted: false },
            data: { isDeleted: true },
          }),
          tx.importLog.updateMany({ where: { importById: { in: userIds }, isDeleted: false }, data: { isDeleted: true } }),
          tx.systemConfig.updateMany({ where: { updatedBy: { in: userIds }, isDeleted: false }, data: { isDeleted: true } }),
          tx.systemLog.updateMany({ where: { userId: { in: userIds }, isDeleted: false }, data: { isDeleted: true } }),
          tx.emailLog.updateMany({ where: { userId: { in: userIds }, isDeleted: false }, data: { isDeleted: true } }),
          tx.document.updateMany({ where: { uploadedBy: { in: userIds }, isDeleted: false }, data: { isDeleted: true } }),
          tx.notificationRecipient.updateMany({
            where: { userId: { in: userIds }, isDeleted: false },
            data: { isDeleted: true },
          }),
          tx.emailTemplate.updateMany({ where: { createdBy: { in: userIds }, isDeleted: false }, data: { isDeleted: true } }),
          tx.groupMember.updateMany({ where: { userId: { in: userIds }, isDeleted: false }, data: { isDeleted: true } }),
          tx.groupMentor.updateMany({
            where: { OR: [{ mentorId: { in: userIds } }, { addedBy: { in: userIds } }], isDeleted: false },
            data: { isDeleted: true },
          }),
          tx.councilMember.updateMany({ where: { userId: { in: userIds }, isDeleted: false }, data: { isDeleted: true } }),
          tx.submissionPeriod.updateMany({
            where: { createdBy: { in: userIds }, isDeleted: false },
            data: { isDeleted: true },
          }),
          tx.progressReportMentor.updateMany({
            where: { mentorId: { in: userIds }, isDeleted: false },
            data: { isDeleted: true },
          }),
          tx.decision.updateMany({ where: { createdBy: { in: userIds }, isDeleted: false }, data: { isDeleted: true } }),
          tx.reviewAssignment.updateMany({
            where: { reviewerId: { in: userIds }, isDeleted: false },
            data: { isDeleted: true },
          }),
          tx.topicRegistration.updateMany({
            where: { OR: [{ userId: { in: userIds } }, { reviewerId: { in: userIds } }], isDeleted: false },
            data: { isDeleted: true },
          }),
          tx.aIVerificationLog.updateMany({
            where: { verifiedBy: { in: userIds }, isDeleted: false },
            data: { isDeleted: true },
          }),
        ]);

        // Xóa users
        await tx.user.updateMany({
          where: { id: { in: userIds }, isDeleted: false },
          data: { isDeleted: true },
        });
      }

      // Ghi log
      await tx.systemLog.create({
        data: {
          userId: deletedByUserId,
          action: 'DELETE_ALL_USERS',
          entityType: 'User',
          entityId: 'ALL',
          description: `Đã đánh dấu xóa ${userIds.length} người dùng ${semesterId ? `trong học kỳ ${semesterCode}` : 'toàn bộ'} bởi admin`,
          severity: 'INFO',
          ipAddress: 'unknown',
          metadata: {
            deletedBy: deletedByUserId,
            userCount: userIds.length,
            semesterId: semesterId || null,
            semesterCode: semesterCode || null,
          },
        },
      });

      return { message: `Xóa mềm ${userIds.length} người dùng và dữ liệu liên quan ${semesterId ? `trong học kỳ ${semesterCode}` : 'toàn bộ'} thành công!` };
    });
  }
}