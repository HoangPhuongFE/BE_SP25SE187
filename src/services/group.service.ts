import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../utils/email";
import { GROUP_MESSAGE, USER_MESSAGE, EMAIL_MESSAGE } from "../constants/message";
import { SystemConfigService } from "../services/system.config.service";
import HTTP_STATUS from '../constants/httpStatus';
import { nowVN } from "../utils/date";
const prisma = new PrismaClient();
const systemConfigService = new SystemConfigService();

export class GroupService {
  // 1) Tạo nhóm
  async createGroup(leaderId: string) {
    try {
      // 1. Tìm học kỳ UPCOMING gần nhất
      const upcomingSemester = await prisma.semester.findFirst({
        where: {
          status: "UPCOMING",
          isDeleted: false,
          startDate: {
            gte: nowVN()  // Sửa: Dùng nowVN()
          }
        },
        orderBy: {
          startDate: 'asc'
        },
        select: { id: true, status: true, startDate: true },
      });

      if (!upcomingSemester) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Không tìm thấy học kỳ sắp tới nào để tạo nhóm.",
        };
      }

      const semesterId = upcomingSemester.id;

      // 2. Kiểm tra sinh viên (trưởng nhóm)
      const leader = await prisma.student.findUnique({
        where: { userId: leaderId },
        include: { major: true },
      });
      if (!leader) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: GROUP_MESSAGE.STUDENT_NOT_FOUND,
        };
      }
      if (!leader.major) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: "Sinh viên không có chuyên ngành được gán.",
        };
      }

      // 3. Kiểm tra sinh viên có thuộc học kỳ không
      const studentSemester = await prisma.semesterStudent.findFirst({
        where: { studentId: leader.id, semesterId: upcomingSemester.id },
      });
      if (!studentSemester) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: GROUP_MESSAGE.STUDENT_NOT_IN_SEMESTER,
        };
      }
      if (studentSemester.qualificationStatus.trim().toLowerCase() !== "qualified") {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: `${GROUP_MESSAGE.STUDENT_NOT_QUALIFIED} Trạng thái hiện tại: ${studentSemester.qualificationStatus}`,
        };
      }

      // 4. Kiểm tra sinh viên đã tham gia nhóm nào trong học kỳ chưa
      const existingMembership = await prisma.groupMember.findFirst({
        where: { studentId: leader.id, group: { semesterId: upcomingSemester.id }, isDeleted: false },
      });
      if (existingMembership) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: "Sinh viên đã là thành viên của một nhóm trong học kỳ này.",
        };
      }

      // 5. Tạo mã nhóm
      const majorName = (leader.major.name || "").trim();
      const groupCode = await this.generateUniqueGroupCode(majorName, upcomingSemester.id, new Date(upcomingSemester.startDate));

      // 6. Lấy số lượng thành viên tối đa và role leader
      const maxMembers = await systemConfigService.getMaxGroupMembers();
      if (maxMembers <= 0) {
        throw new Error("Số lượng thành viên tối đa không hợp lệ.");
      }
      const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
      if (!leaderRole) {
        return {
          success: false,
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          message: "Vai trò 'leader' không tồn tại trong hệ thống.",
        };
      }

      // 7. Tạo nhóm và thêm trưởng nhóm
      const newGroup = await prisma.group.create({
        data: {
          groupCode,
          semesterId: upcomingSemester.id,
          status: "ACTIVE",
          createdBy: leaderId,
          maxMembers,
          isAutoCreated: false,
          createdAt: nowVN(), // Thêm: Rõ ràng gán createdAt bằng nowVN()
          members: {
            create: [
              {
                studentId: leader.id,
                roleId: leaderRole.id,
                status: "ACTIVE",
                userId: leaderId,
              },
            ],
          },
        },
        include: {
          members: {
            include: { role: true },
          },
        },
      });

      // 8. Format và trả về kết quả
      const formattedGroup = {
        ...newGroup,
        members: newGroup.members.map(member => ({
          studentId: member.studentId,
          role: member.role.name,
          status: member.status,
        })),
      };

      return {
        success: true,
        status: HTTP_STATUS.CREATED,
        message: GROUP_MESSAGE.GROUP_CREATED,
        data: formattedGroup,
      };
    } catch (error) {
      console.error("Lỗi khi tạo nhóm:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống khi tạo nhóm.",
      };
    }
  }
  // 2) Mời thành viên (sinh viên)
  async inviteMember(
    groupId: string | undefined,
    groupCode: string | undefined,
    studentEmail: string | undefined,
    studentId: string | undefined,
    invitedById: string
  ) {
    try {
      // 1 Tìm sinh viên theo studentId hoặc email
      const invitedStudent = studentId
        ? await prisma.student.findUnique({
          where: { id: studentId },
          select: {
            id: true,
            studentCode: true,
            userId: true,
            major: { select: { id: true } },
            user: { select: { email: true, fullName: true, username: true } },
          },
        })
        : studentEmail
          ? await prisma.student.findFirst({
            where: { user: { email: studentEmail } },
            select: {
              id: true,
              studentCode: true,
              userId: true,
              major: { select: { id: true } },
              user: { select: { email: true, fullName: true, username: true } },
            },
          })
          : null;

      if (!invitedStudent) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: `Không tìm thấy sinh viên với ${studentId ? `ID: ${studentId}` : `email: ${studentEmail}`}`,
        };
      }

      // 2 Tìm thông tin người mời
      const inviter = await prisma.user.findUnique({
        where: { id: invitedById },
        include: { roles: { include: { role: true } } },
      });

      if (!inviter) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: `Người mời không tồn tại với ID=${invitedById}`,
        };
      }

      // 3 Kiểm tra quyền của người mời
      const userRoles = inviter.roles.map((r) => r.role.name.toLowerCase());
      if (!userRoles.includes('leader') && !userRoles.includes('academic_officer')) {
        const inviterStudent = await prisma.student.findFirst({ where: { userId: invitedById } });

        const leaderRole = await prisma.role.findUnique({ where: { name: 'leader' } });
        if (!leaderRole) throw new Error("Vai trò 'leader' không tồn tại.");

        const isLeader = await prisma.groupMember.findFirst({
          where: {
            groupId: groupId || undefined,
            studentId: inviterStudent?.id,
            roleId: leaderRole.id,
            isActive: true,
          },
        });

        const isMentor = await prisma.groupMentor.findFirst({
          where: { groupId: groupId || undefined, mentorId: invitedById },
        });

        if (!isLeader && !isMentor) {
          return {
            success: false,
            status: HTTP_STATUS.FORBIDDEN,
            message: GROUP_MESSAGE.NO_PERMISSION_INVITE,
          };
        }
      }

      // 4 Kiểm tra nhóm có tồn tại không
      const whereClause = groupId
        ? { id: groupId }
        : groupCode
          ? { groupCode: groupCode }
          : undefined;

      if (!whereClause) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: 'Cần cung cấp groupId hoặc groupCode hợp lệ.',
        };
      }

      const group = await prisma.group.findFirst({
        where: whereClause,
        select: {
          id: true,
          groupCode: true,
          semesterId: true,
          isLocked: true,
          isMultiMajor: true,
          majorPairConfigId: true,
          members: {
            select: {
              studentId: true,
              student: { select: { major: { select: { id: true } } } },
            },
          },
          majorPairConfig: {
            select: { id: true, firstMajorId: true, secondMajorId: true, semesterId: true, isActive: true, isDeleted: true },
          },
        },
      });

      if (!group) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: GROUP_MESSAGE.GROUP_NOT_FOUND,
        };
      }

      if (group.isLocked) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: GROUP_MESSAGE.GROUP_LOCKED,
        };
      }

      // 5 Kiểm tra số lượng thành viên nhóm
      const maxMembers = await systemConfigService.getMaxGroupMembers();
      if (group.members.length >= maxMembers) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: `${GROUP_MESSAGE.MAX_GROUP_MEMBERS_REACHED} (Tối đa ${maxMembers} người).`,
        };
      }

      // 6 Kiểm tra sinh viên đã trong nhóm chưa
      if (group.members.some((m) => m.studentId === invitedStudent.id)) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: GROUP_MESSAGE.MEMBER_ALREADY_EXISTS,
        };
      }

      // 7 Kiểm tra điều kiện tham gia nhóm
      const studentSemester = await prisma.semesterStudent.findFirst({
        where: { studentId: invitedStudent.id, semesterId: group.semesterId },
      });

      if (!studentSemester || studentSemester.qualificationStatus.trim().toLowerCase() !== 'qualified') {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: GROUP_MESSAGE.STUDENT_NOT_QUALIFIED,
        };
      }

      // 8 Kiểm tra ngành học có khớp nhóm không
      if (group.isMultiMajor && group.majorPairConfigId && group.majorPairConfig) {
        if (!group.majorPairConfig.isActive || group.majorPairConfig.isDeleted) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: 'Cấu hình liên ngành không hoạt động hoặc đã bị xóa',
          };
        }

        if (group.majorPairConfig.semesterId !== group.semesterId) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: 'Cấu hình liên ngành không thuộc học kỳ của nhóm',
          };
        }

        if (
          invitedStudent.major?.id !== group.majorPairConfig.firstMajorId &&
          invitedStudent.major?.id !== group.majorPairConfig.secondMajorId
        ) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: 'Ngành của sinh viên không thuộc cấu hình liên ngành của nhóm',
          };
        }
      } else if (!group.isMultiMajor && group.members.length > 0) {
        const groupMajor = group.members[0]?.student?.major?.id;
        const invitedMajor = invitedStudent.major?.id;

        if (invitedMajor && groupMajor && invitedMajor !== groupMajor) {
          return {
            success: false,
            status: HTTP_STATUS.BAD_REQUEST,
            message: GROUP_MESSAGE.GROUP_MAJOR_MISMATCH,
          };
        }
      }

      // 9 Kiểm tra lời mời trước đó
      const existingInvitation = await prisma.groupInvitation.findFirst({
        where: { groupId: group.id, studentId: invitedStudent.id, status: 'PENDING' },
      });

      if (existingInvitation) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: GROUP_MESSAGE.INVITATION_EXISTS,
        };
      }

      // 10 Tạo lời mời
      const invitation = await prisma.groupInvitation.create({
        data: {
          groupId: group.id,
          studentId: invitedStudent.id,
          status: 'PENDING',
          expiresAt: new Date(nowVN().getTime() + 2 * 60 * 60 * 1000), // Sửa: Dùng nowVN() (hết hạn sau 2 giờ)
        },
      });

      // 11 Gửi email lời mời
      if (invitedStudent.user?.email) {
        const invitationLink = `http://103.185.184.198:6969/api/groups/accept-invitation/${invitation.id}`;
        //const invitationLink = `http://localhost:3000/api/groups/accept-invitation/${invitation.id}`;

        const emailContent = `
        <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
          <p>Xin chào <strong>${ invitedStudent.user.username}</strong>,</p>
          <p>Bạn đã được mời tham gia nhóm <b>${group.groupCode}</b>.</p>
          <p>Vui lòng nhấn vào nút bên dưới để chấp nhận lời mời:</p>
          <p style="margin-top: 20px;">
            <a href="${invitationLink}" 
               style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
              Chấp nhận lời mời
            </a>
          </p>
          <p style="margin-top: 30px;">Nếu bạn không mong đợi email này, vui lòng bỏ qua.</p>
        </div>
      `;

        try {
          await sendEmail(invitedStudent.user.email, 'Lời mời tham gia nhóm', emailContent);
          return {
            success: true,
            status: HTTP_STATUS.OK,
            message: GROUP_MESSAGE.INVITATION_SENT,
            data: { invitation, invitationLink },
          };
        } catch (error) {
          console.error(`Lỗi gửi email cho ${invitedStudent.user.email}:`, error);
          return {
            success: false,
            status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
            message: EMAIL_MESSAGE.EMAIL_FAILED,
          };
        }
      }

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: GROUP_MESSAGE.INVITATION_SENT,
        data: invitation,
      };
    } catch (error) {
      console.error('Lỗi trong inviteMember:', error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống khi mời thành viên.',
      };
    }
  }

  // 3) respondToInvitation
  async respondToInvitation(
    invitationId: string,
    userId: string,
    response: "ACCEPTED" | "REJECTED"
  ) {
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      return {
        success: false,
        status: HTTP_STATUS.UNAUTHORIZED,
        message: USER_MESSAGE.UNAUTHORIZED,
      };
    }

    const invitation = await prisma.groupInvitation.findUnique({
      where: { id: invitationId },
      include: { group: true },
    });

    if (!invitation) {
      return {
        success: false,
        status: HTTP_STATUS.NOT_FOUND,
        message: GROUP_MESSAGE.INVITATION_NOT_FOUND,
      };
    }

    if (invitation.studentId !== student.id) {
      return {
        success: false,
        status: HTTP_STATUS.FORBIDDEN,
        message: USER_MESSAGE.UNAUTHORIZED,
      };
    }

    const updatedInvitation = await prisma.groupInvitation.update({
      where: { id: invitationId },
      data: { status: response, respondedAt: nowVN() }, // Sửa: Dùng nowVN()
    });

    if (response === "ACCEPTED") {
      const memberRole = await prisma.role.findUnique({ where: { name: "member" } });
      if (!memberRole) throw new Error("Vai trò 'member' không tồn tại.");

      await prisma.groupMember.create({
        data: {
          groupId: invitation.groupId,
          studentId: student.id,
          roleId: memberRole.id,
          status: "ACTIVE",
        },
      });

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: GROUP_MESSAGE.INVITATION_ACCEPTED,
        data: updatedInvitation,
      };
    }

    return {
      success: true,
      status: HTTP_STATUS.OK,
      message: GROUP_MESSAGE.INVITATION_REJECTED,
      data: updatedInvitation,
    };
  }

  // 4) getGroupInfo
  async getGroupInfo(groupId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        _count: { select: { members: true } },
        members: {
          include: {
            student: {
              include: { user: true },
            },
            role: true,
          },
        },
      },
    });

    if (!group) throw new Error("Nhóm không tồn tại.");

    return {
      ...group,
      totalMembers: group._count.members,
    };
  }
  // getInvitationById
  async getInvitationById(invitationId: string) {
    return prisma.groupInvitation.findUnique({
      where: { id: invitationId },
    });
  }

  // forceAcceptInvitation
  async forceAcceptInvitation(invitationId: string, studentId: string, p0: string) {
    const invitation = await prisma.groupInvitation.findUnique({
      where: { id: invitationId },
      include: { group: true },
    });
    if (!invitation) throw new Error("Lời mời không tồn tại.");
    if (invitation.status !== "PENDING") {
      throw new Error("Lời mời đã được xử lý hoặc hết hạn.");
    }

    await prisma.groupInvitation.update({
      where: { id: invitationId },
      data: { status: "ACCEPTED", respondedAt: nowVN() }, // Sửa: Dùng nowVN()
    });

    const memberRole = await prisma.role.findUnique({ where: { name: "member" } });
    if (!memberRole) throw new Error("Vai trò 'member' không tồn tại.");

    await prisma.groupMember.create({
      data: {
        groupId: invitation.groupId,
        studentId: invitation.studentId,
        roleId: memberRole.id,
        status: "ACTIVE",
      },
    });
    return { message: "Lời mời đã được chấp nhận. " };
  }



  async getGroupsBySemester(semesterId: string, userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });

    if (!user) throw new Error("Người dùng không tồn tại.");

    const userRoles = user.roles.map((r) => r.role.name.toLowerCase());

    const baseInclude = {
      members: {
        include: {
          student: { include: { user: true } },
          role: true,
        },
      },
      mentors: {
        include: {
          mentor: { select: { id: true, fullName: true, email: true } },
          role: true,
        },
      },
      topicAssignments: {
        where: { isDeleted: false },
        select: {
          defendStatus: true,
          defenseRound: true,
        },
      },
    };

    //  Trường hợp cán bộ quản lý
    if (
      userRoles.includes("academic_officer") ||
      userRoles.includes("graduation_thesis_manager") ||
      userRoles.includes("examination_officer")
    ) {
      return prisma.group.findMany({
        where: {
          semesterId,
          isDeleted: false,
        },
        include: baseInclude,
      });
    }

    //  Trường hợp sinh viên: chỉ lấy nhóm của chính mình
    if (userRoles.includes("student")) {
      const student = await prisma.student.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!student) throw new Error("Không tìm thấy sinh viên.");

      return prisma.group.findMany({
        where: {
          semesterId,
          isDeleted: false,
          members: {
            some: {
              studentId: student.id,
              isDeleted: false,
            },
          },
        },
        include: baseInclude,
      });
    }

    //  Trường hợp mentor: chỉ lấy nhóm đang hướng dẫn
    if (
      userRoles.includes("mentor_main") ||
      userRoles.includes("mentor_sub") ||
      userRoles.includes("lecturer")
    ) {
      const groupMentorIds = await prisma.groupMentor.findMany({
        where: {
          mentorId: userId,
          isDeleted: false,
        },
        select: { groupId: true },
      });

      const groupIds = groupMentorIds.map((gm) => gm.groupId);

      if (groupIds.length === 0) return [];

      return prisma.group.findMany({
        where: {
          id: { in: groupIds },
          semesterId,
          isDeleted: false,
        },
        include: baseInclude,
      });
    }

    throw new Error("Bạn không có quyền truy cập danh sách nhóm.");
  }

  // 6) getStudentsWithoutGroup - Lấy danh sách sinh viên chưa có nhóm và đủ điều kiện
  async getStudentsWithoutGroup(semesterId: string) {
    try {
      // 1. Kiểm tra học kỳ có tồn tại và không bị xóa
      const semesterExists = await prisma.semester.findUnique({
        where: {
          id: semesterId,
          isDeleted: false
        },
        select: { id: true }
      });

      if (!semesterExists) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Học kỳ không tồn tại hoặc đã bị xóa."
        };
      }

      // 2. Lấy danh sách sinh viên đủ điều kiện nhưng chưa có nhóm
      const students = await prisma.student.findMany({
        where: {
          // Sinh viên thuộc học kỳ này
          semesterStudents: {
            some: {
              semesterId,
              isEligible: true, // Đủ điều kiện
              qualificationStatus: "qualified", // Trạng thái đủ điều kiện
              semester: {
                isDeleted: false // Học kỳ không bị xóa
              }
            }
          },
          // Sinh viên chưa có nhóm trong học kỳ này
          NOT: {
            groupMembers: {
              some: {
                group: {
                  semesterId,
                  isDeleted: false // Nhóm không bị xóa
                }
              }
            }
          },
          isDeleted: false // Sinh viên không bị xóa
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            }
          },
          major: {
            select: {
              id: true,
              name: true
            }
          },
          specialization: {
            select: {
              id: true,
              name: true
            }
          },
          semesterStudents: {
            where: {
              semesterId,
              isEligible: true,
              qualificationStatus: "qualified"
            },
            select: {
              status: true,
              isEligible: true,
              qualificationStatus: true
            }
          }
        },
        orderBy: {
          studentCode: 'asc' // Sắp xếp theo mã sinh viên
        }
      });

      // 3. Format dữ liệu trả về
      const formattedStudents = students.map(student => ({
        id: student.id,
        studentCode: student.studentCode,
        username: student.user?.username || 'Không có tên',
        email: student.user?.email || 'Không có email',
        major: student.major?.name || 'Không có chuyên ngành',
        specialization: student.specialization?.name || 'Không có chuyên ngành hẹp',
        qualificationStatus: student.semesterStudents[0]?.qualificationStatus || '',
        status: student.semesterStudents[0]?.status || '',
        isEligible: student.semesterStudents[0]?.isEligible || false
      }));

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: "Danh sách sinh viên chưa có nhóm và đủ điều kiện.",
        data: formattedStudents
      };
    } catch (error) {
      console.error("Lỗi khi lấy danh sách sinh viên chưa có nhóm:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống khi lấy danh sách sinh viên chưa có nhóm."
      };
    }
  }


  private async generateUniqueGroupCode(
    professionName: string,
    semesterId: string,
    semesterStartDate: Date
  ): Promise<string> {
    if (!professionName || !semesterId || !semesterStartDate) {
      throw new Error("Thiếu thông tin cần thiết để tạo mã nhóm.");
    }

    const yearSuffix = semesterStartDate.getFullYear().toString().slice(-2);

    // Hàm lấy mã ngành từ chữ cái đầu mỗi từ
    const getMajorCode = (name: string): string => {
      const professionMap: { [key: string]: string } = {
        "Software Engineering": "SE",
        "Artificial Intelligence": "AI",
        "Information Assurance": "IA",
        "Information Technology Systems": "ITS"
      };

      if (professionMap[name]) {
        return professionMap[name];
      }

      // Dự phòng: Lấy chữ cái đầu mỗi từ
      const words = name.trim().split(/\s+/);
      if (words.length > 1) {
        return words.map(word => word[0]).join("").toUpperCase();
      }

      // Dự phòng cho tên ngắn: lấy 2 chữ cái đầu hoặc chữ cái đầu + "X"
      return name.length >= 2
        ? name.slice(0, 2).toUpperCase()
        : (name[0] + "X").toUpperCase();
    };

    const majorCode = getMajorCode(professionName);
    const groupCodePrefix = `G${yearSuffix}${majorCode}`;

    let sequenceNumber = 1;
    let groupCode = `${groupCodePrefix}${sequenceNumber.toString().padStart(3, "0")}`;
    const maxAttempts = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const existingGroup = await prisma.group.findUnique({
        where: { semesterId_groupCode: { semesterId, groupCode } },
      });

      if (!existingGroup) {
        return groupCode;
      }

      sequenceNumber++;
      groupCode = `${groupCodePrefix}${sequenceNumber.toString().padStart(3, "0")}`;
    }

    throw new Error(`Không thể tạo mã nhóm duy nhất sau ${maxAttempts} lần thử cho prefix ${groupCodePrefix}.`);
  }





  async randomizeGroups(semesterId: string, createdBy: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: createdBy },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new Error("Người dùng không tồn tại.");

    const userRoles = user.roles.map((r) => r.role.name.toLowerCase());
    const isAuthorized = userRoles.includes("admin") || userRoles.includes("graduation_thesis_manager") || userRoles.includes("academic_officer");
    if (!isAuthorized) throw new Error("Bạn không có quyền thực hiện random nhóm.");

    const maxGroupConfig = await prisma.systemConfig.findUnique({ where: { configKey: "MAX_GROUP_MEMBERS", isDeleted: false } });
    const minGroupConfig = await prisma.systemConfig.findUnique({ where: { configKey: "MIN_GROUP_MEMBERS", isDeleted: false } });
    const groupSize = Number(maxGroupConfig?.configValue || 5);
    const minGroupSize = Number(minGroupConfig?.configValue || 4);

    const existingGroups = await prisma.group.findMany({
      where: {
        semesterId,
        isMultiMajor: false,
        isAutoCreated: false,
        isDeleted: false,
        topicAssignments: { none: { isDeleted: false } },
      },
      include: {
        members: true,
      },
    });

    for (const group of existingGroups) {
      if (group.members.length < minGroupSize) {
        await prisma.groupMember.updateMany({ where: { groupId: group.id }, data: { isDeleted: true } });
        await prisma.group.update({ where: { id: group.id }, data: { isDeleted: true } });
      }
    }

    const students = await prisma.student.findMany({
      where: {
        semesterStudents: {
          some: {
            semesterId,
            qualificationStatus: "qualified",
          },
        },
        groupMembers: {
          none: {
            isDeleted: false,
            group: {
              semesterId,
              isDeleted: false,
            },
          },
        },
      },
      include: {
        user: { select: { programming_language: true, id: true } },
        major: true,
      },
    });

    if (students.length === 0) {
      return { message: "Không có sinh viên nào đủ điều kiện để tạo nhóm." };
    }

    const groupedByProfession: { [key: string]: typeof students } = {};
    for (const st of students) {
      const profName = st.major?.name || "Unknown";
      if (!groupedByProfession[profName]) groupedByProfession[profName] = [];
      groupedByProfession[profName].push(st);
    }

    const createdGroups = [];
    const popOne = (arr: any[]) => (arr.length === 0 ? null : arr.pop());

    const semester = await prisma.semester.findUnique({
      where: { id: semesterId, isDeleted: false },
      select: { startDate: true },
    });
    if (!semester?.startDate) throw new Error("Học kỳ không tồn tại hoặc không có ngày bắt đầu.");

    const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
    const memberRole = await prisma.role.findUnique({ where: { name: "member" } });
    if (!leaderRole || !memberRole) throw new Error("Vai trò 'leader' hoặc 'member' không tồn tại.");

    let containsSmallGroups = false;

    for (const professionName in groupedByProfession) {
      const studentsInProf = groupedByProfession[professionName];

      let fe = studentsInProf.filter(s => s.user?.programming_language === "Front-end").reverse();
      let be = studentsInProf.filter(s => s.user?.programming_language === "Back-end").reverse();
      let fs = studentsInProf.filter(s => s.user?.programming_language === "Full-stack").reverse();
      let unknown = studentsInProf.filter(s => !["Front-end", "Back-end", "Full-stack"].includes(s.user?.programming_language || "")).reverse();

      while (fe.length > 0 || be.length > 0 || fs.length > 0 || unknown.length > 0) {
        const groupMembers: typeof studentsInProf = [];

        const pickBE = popOne(be) || popOne(unknown);
        if (pickBE) groupMembers.push(pickBE);
        const pickFE = popOne(fe) || popOne(unknown);
        if (pickFE) groupMembers.push(pickFE);
        const pickFS = popOne(fs) || popOne(unknown);
        if (pickFS) groupMembers.push(pickFS);

        while (groupMembers.length < groupSize) {
          const buckets = [];
          if (fe.length) buckets.push("FE");
          if (be.length) buckets.push("BE");
          if (fs.length) buckets.push("FS");
          if (unknown.length) buckets.push("Unknown");

          if (!buckets.length) break;
          const choice = buckets[Math.floor(Math.random() * buckets.length)];
          let candidate = null;
          if (choice === "FE") candidate = popOne(fe);
          else if (choice === "BE") candidate = popOne(be);
          else if (choice === "FS") candidate = popOne(fs);
          else candidate = popOne(unknown);
          if (candidate) groupMembers.push(candidate);
        }

        if (groupMembers.length < minGroupSize) {
          containsSmallGroups = true;
        }

        const leaderIndex = Math.floor(Math.random() * groupMembers.length);
        [groupMembers[0], groupMembers[leaderIndex]] = [groupMembers[leaderIndex], groupMembers[0]];

        const groupCode = await this.generateUniqueGroupCode(professionName, semesterId, semester.startDate);

        const newGroup = await prisma.group.create({
          data: {
            groupCode,
            semesterId,
            status: "ACTIVE",
            createdBy,
            maxMembers: groupSize,
            isAutoCreated: true,
            isMultiMajor: false,
            createdAt: nowVN(), // Thêm: Rõ ràng gán createdAt bằng nowVN()
            members: {
              create: groupMembers.map((member, idx) => ({
                studentId: member.id,
                roleId: idx === 0 ? leaderRole.id : memberRole.id,
                status: "ACTIVE",
                isDeleted: false,
              })),
            },
          },
          include: { members: { include: { role: true } } },
        });

        const formattedGroup = {
          ...newGroup,
          members: newGroup.members.map((m) => ({
            studentId: m.studentId,
            role: m.role.name,
            status: m.status,
          })),
        };

        createdGroups.push(formattedGroup);
      }
    }

    return {
      message: "Random nhóm thành công!",
      totalGroups: createdGroups.length,
      containsSmallGroups,
      data: createdGroups,
    };
  }


  async changeLeader(
    groupId: string | undefined,
    groupCode: string | undefined,
    newLeaderId: string | undefined,
    newLeaderEmail: string | undefined,
    userId: string
  ) {
    const whereClause = groupId ? { id: groupId } : groupCode ? { groupCode: groupCode } : undefined;
    if (!whereClause) throw new Error("Cần cung cấp groupId hoặc groupCode hợp lệ.");

    const group = await prisma.group.findFirst({
      where: whereClause,
      include: { members: { include: { student: { include: { user: true } } } } },
    });

    if (!group) throw new Error("Nhóm không tồn tại.");
    if (group.isLocked) throw new Error("Nhóm đã bị khóa. Không thể thay đổi leader.");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });

    if (!user) throw new Error("Người dùng không tồn tại.");
    const userRoles = user.roles.map((r) => r.role.name.toLowerCase());
    const isAdmin = userRoles.includes("admin") || userRoles.includes("graduation_thesis_manager") || userRoles.includes("academic_officer");

    let isAuthorized = isAdmin;
    const student = await prisma.student.findUnique({ where: { userId } });

    if (student) {
      const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
      if (!leaderRole) throw new Error("Vai trò 'leader' không tồn tại.");

      const isLeader = await prisma.groupMember.findFirst({
        where: { groupId: group.id, studentId: student.id, roleId: leaderRole.id, isActive: true },
      });
      if (isLeader) isAuthorized = true;
    }

    const isMentor = await prisma.groupMentor.findFirst({ where: { groupId: group.id, mentorId: userId } });
    if (isMentor) isAuthorized = true;

    if (!isAuthorized) throw new Error("Bạn không có quyền đổi leader.");

    let newLeader = newLeaderId
      ? group.members.find((m) => m.student?.id === newLeaderId)
      : newLeaderEmail
        ? group.members.find((m) => m.student?.user?.email === newLeaderEmail)
        : null;

    if (!newLeader) throw new Error("Người dùng này không thuộc nhóm hoặc không hợp lệ.");

    // Truy vấn roleId cho "member" và "leader"
    const memberRole = await prisma.role.findUnique({ where: { name: "member" } });
    const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
    if (!memberRole || !leaderRole) throw new Error("Vai trò 'member' hoặc 'leader' không tồn tại.");

    // Đổi tất cả thành viên thành "member"
    await prisma.groupMember.updateMany({
      where: { groupId: group.id },
      data: { roleId: memberRole.id }, // Sử dụng roleId
    });

    // Cập nhật leader mới
    await prisma.groupMember.update({
      where: { id: newLeader.id },
      data: { roleId: leaderRole.id }, // Sử dụng roleId
    });

    return { message: "Leader đã được thay đổi thành công." };
  }

  // 9) addMentorToGroup
  async addMentorToGroup(
    groupId: string | undefined,
    groupCode: string | undefined,
    mentorId: string | undefined,
    mentorEmail: string | undefined,
    addedBy: string
  ) {
    // Xác định điều kiện tìm kiếm nhóm dựa trên groupId hoặc groupCode
    const whereClause = groupId ? { id: groupId } : groupCode ? { groupCode: groupCode } : undefined;
    if (!whereClause) throw new Error("Cần cung cấp groupId hoặc groupCode hợp lệ.");

    // Tìm nhóm trong cơ sở dữ liệu
    const group = await prisma.group.findFirst({
      where: whereClause,
      include: { mentors: true },
    });

    if (!group) throw new Error("Nhóm không tồn tại.");
    if (group.isLocked) throw new Error("Nhóm đã bị khóa. Không thể thêm mentor.");

    // Đếm số lượng mentor hiện tại trong nhóm
    const mentorCount = await prisma.groupMentor.count({ where: { groupId: group.id } });
    const maxMentors = await systemConfigService.getMaxGroupMentors();
    if (mentorCount >= maxMentors) throw new Error(`Nhóm đã đủ mentor (tối đa ${maxMentors} mentor).`);

    // Kiểm tra thông tin người thực hiện hành động (addedBy)
    const user = await prisma.user.findUnique({
      where: { id: addedBy },
      include: { roles: { include: { role: true } } },
    });

    if (!user) throw new Error("Người dùng không tồn tại.");
    const userRoles = user.roles.map(r => r.role.name.toLowerCase());
    const isAdmin = userRoles.includes("admin") || userRoles.includes("graduation_thesis_manager") || userRoles.includes("academic_officer");

    // Xác định quyền thực hiện hành động
    let isAuthorized = isAdmin;
    const student = await prisma.student.findUnique({ where: { userId: addedBy } });
    if (student) {
      const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
      if (!leaderRole) throw new Error("Vai trò 'leader' không tồn tại.");

      const leader = await prisma.groupMember.findFirst({
        where: { groupId: group.id, studentId: student.id, roleId: leaderRole.id, isActive: true },
      });
      if (leader) isAuthorized = true;
    }

    const mentorInGroup = await prisma.groupMentor.findFirst({ where: { groupId: group.id, mentorId: addedBy } });
    if (mentorInGroup) isAuthorized = true;

    if (!isAuthorized) throw new Error("Bạn không có quyền thêm mentor vào nhóm.");

    // Tìm thông tin mentor dựa trên mentorId hoặc mentorEmail
    let mentorUser = mentorId
      ? await prisma.user.findUnique({ where: { id: mentorId }, include: { roles: { include: { role: true } } } })
      : mentorEmail
        ? await prisma.user.findFirst({ where: { email: mentorEmail }, include: { roles: { include: { role: true } } } })
        : null;

    if (!mentorUser || !mentorUser.roles.some(r => r.role.name === "lecturer")) {
      throw new Error("Người dùng này không phải Mentor hoặc không tồn tại.");
    }

    // Kiểm tra mentor đã có trong nhóm chưa
    const existingMentor = await prisma.groupMentor.findFirst({ where: { groupId: group.id, mentorId: mentorUser.id } });
    if (existingMentor) throw new Error("Mentor đã có trong nhóm.");

    // Xác định vai trò của mentor: mentor_main (nếu là mentor đầu tiên) hoặc mentor_sub (nếu đã có mentor)
    const roleName = mentorCount === 0 ? "mentor_main" : "mentor_sub";
    const mentorRole = await prisma.role.findUnique({ where: { name: roleName } });
    if (!mentorRole) throw new Error(`Vai trò '${roleName}' không tồn tại.`);

    // Thêm mentor vào nhóm với vai trò tương ứng
    await prisma.groupMentor.create({
      data: {
        groupId: group.id,
        mentorId: mentorUser.id,
        roleId: mentorRole.id, // Gán vai trò dựa trên mentorCount
        addedBy,
      },
    });

    return { message: "Mentor đã được thêm vào nhóm thành công." };
  }

  // 10) removeMemberFromGroup
  async removeMemberFromGroup(
    groupId: string,
    memberId: string,       // memberId là studentId của thành viên cần xóa
    invitedById: string     // ID của người thực hiện thao tác
  ) {
    try {
      //  console.log('--- Bắt đầu xóa thành viên ---');
      //  console.log('Group ID:', groupId);
      //   console.log('Member ID (thành viên bị xóa):', memberId);
      //  console.log('Invited By ID (người thực hiện):', invitedById);

      // Kiểm tra nhóm có tồn tại và trạng thái không bị khóa
      const group = await prisma.group.findUnique({ where: { id: groupId } });
      if (!group) throw new Error("Nhóm không tồn tại.");
      if (group.isLocked) throw new Error("Nhóm đã bị khóa. Không thể xóa thành viên.");
      //   console.log('Nhóm tồn tại và không bị khóa.');

      // Lấy thông tin người thực hiện hành động cùng với vai trò của họ
      const user = await prisma.user.findUnique({
        where: { id: invitedById },
        include: { roles: { include: { role: true } } },
      });
      if (!user) throw new Error("Người dùng không tồn tại.");
      //    console.log('Thông tin người thực hiện:', user);

      const userRoles = user.roles.map(r => r.role.name.toLowerCase());
      //   console.log('Vai trò của người thực hiện:', userRoles);

      // Xác định các nhóm vai trò:
      // - SuperAdmin: academic_officer, graduation_thesis_manager
      // - Mentor: mentor_main, mentor_sub, và ngoài ra nếu tài khoản có vai trò lecturer, cũng có thể là mentor nếu có record trong GroupMentor.
      const superAdminRoles = ["graduation_thesis_manager", "academic_officer"];
      const mentorRoles = ["mentor_main", "mentor_sub"];

      const isSuperAdmin = userRoles.some(role => superAdminRoles.includes(role));
      const isExplicitMentor = userRoles.some(role => mentorRoles.includes(role));
      const isLecturer = userRoles.includes("lecturer");
      //  console.log('Là SuperAdmin?:', isSuperAdmin);
      //  console.log('Là Explicit Mentor?:', isExplicitMentor);
      //  console.log('Là Lecturer?:', isLecturer);

      let isMentorAssigned = false;
      // Nếu người thực hiện không phải SuperAdmin, kiểm tra xem họ có được giao làm mentor của nhóm hay không.
      if (!isSuperAdmin) {
        // Truy vấn bảng GroupMentor cho cả trường hợp explicit mentor và lecturer.
        const assignedMentor = await prisma.groupMentor.findFirst({
          where: { groupId, mentorId: invitedById },
        });
        //   console.log('Thông tin mentor được giao của nhóm:', assignedMentor);
        if (assignedMentor) {
          isMentorAssigned = true;
        }
      }

      // Nếu người thực hiện thuộc vai trò mentor (explicit hoặc lecturer được giao) thì cho phép xóa.
      if (!isSuperAdmin && !isMentorAssigned) {
        // Nếu không có quyền qua GroupMentor, chuyển sang kiểm tra quyền của Leader (cho sinh viên)
        let isLeader = false;
        let actingStudent = await prisma.student.findUnique({
          where: { userId: invitedById },
          select: { id: true },
        });
        if (!actingStudent) {
          throw new Error("Bạn không có quyền xóa thành viên khỏi nhóm.");
        }
        // console.log('ID của sinh viên thực hiện (actingStudent.id):', actingStudent.id);

        const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
        if (!leaderRole) throw new Error("Vai trò 'leader' không tồn tại.");
        //  console.log('ID vai trò leader:', leaderRole.id);

        isLeader = !!(await prisma.groupMember.findFirst({
          where: { groupId, studentId: actingStudent.id, roleId: leaderRole.id, isActive: true },
        }));
        //   console.log('Là leader của nhóm?:', isLeader);

        if (!isLeader) {
          throw new Error("Bạn không có quyền xóa thành viên khỏi nhóm (chỉ leader, mentor của nhóm hoặc academic_officer/graduation_thesis_manager có quyền).");
        }
        // Nếu là leader, kiểm tra leader không tự xóa chính mình.
        if (isLeader && memberId === actingStudent.id) {
          //  console.log('Leader đang cố tự xóa chính mình.');
          throw new Error("Leader không thể tự xóa chính mình khỏi nhóm. Hãy đổi leader trước.");
        }
      }

      // Kiểm tra thông tin thành viên cần xóa (memberId ở đây là studentId của thành viên)
      const member = await prisma.groupMember.findFirst({
        where: { groupId, studentId: memberId },
      });
      if (!member) throw new Error("Thành viên không tồn tại trong nhóm.");
      // console.log('Thông tin thành viên bị xóa:', member);

      // Thực hiện xóa thành viên
      await prisma.groupMember.delete({ where: { id: member.id } });
      //console.log('Xóa thành viên thành công.');
      return { message: "Xóa thành viên khỏi nhóm thành công." };
    } catch (error) {
      //  console.error('Lỗi khi xóa thành viên:', error);
      throw error;
    }
  }

  async deleteGroup(groupId: string, userId: string, ipAddress?: string) {
    try {
      // Kiểm tra thông tin người dùng và vai trò
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } },
      });
      if (!user) {
        await prisma.systemLog.create({
          data: {
            userId,
            action: "DELETE_GROUP_ATTEMPT",
            entityType: "Group",
            entityId: groupId,
            description: "Thử xóa nhóm nhưng người dùng không tồn tại",
            severity: "ERROR",
            ipAddress: ipAddress || "unknown",
          },
        });
        throw new Error("Người dùng không tồn tại.");
      }

      const userRoles = user.roles.map((r) => r.role.name.toLowerCase());
      const isAdmin = userRoles.includes("academic_officer") || userRoles.includes("graduation_thesis_manager");

      const student = await prisma.student.findUnique({ where: { userId } });
      let isLeader = false;
      if (student) {
        const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
        if (!leaderRole) {
          await prisma.systemLog.create({
            data: {
              userId,
              action: "DELETE_GROUP_ATTEMPT",
              entityType: "Group",
              entityId: groupId,
              description: 'Vai trò "leader" không tồn tại trong hệ thống',
              severity: "ERROR",
              ipAddress: ipAddress || "unknown",
            },
          });
          throw new Error('Vai trò "leader" không tồn tại.');
        }
        const leader = await prisma.groupMember.findFirst({
          where: { groupId, studentId: student.id, roleId: leaderRole.id, isActive: true, isDeleted: false },
        });
        if (leader) isLeader = true;
      }

      if (!isAdmin && !isLeader) {
        await prisma.systemLog.create({
          data: {
            userId,
            action: "DELETE_GROUP_ATTEMPT",
            entityType: "Group",
            entityId: groupId,
            description: "Thử xóa nhóm nhưng không có quyền (chỉ academic_officer)",
            severity: "WARNING",
            ipAddress: ipAddress || "unknown",
            metadata: { userRoles },
          },
        });
        throw new Error("Bạn không có quyền xóa nhóm (chỉ academic_officer).");
      }

      const group = await prisma.group.findUnique({
        where: { id: groupId, isDeleted: false },
        include: { members: true, topicAssignments: true },
      });
      if (!group) {
        await prisma.systemLog.create({
          data: {
            userId,
            action: "DELETE_GROUP_ATTEMPT",
            entityType: "Group",
            entityId: groupId,
            description: "Thử xóa nhóm nhưng không tìm thấy hoặc đã bị đánh dấu xóa",
            severity: "WARNING",
            ipAddress: ipAddress || "unknown",
          },
        });
        throw new Error("Nhóm không tồn tại.");
      }

      if (!isAdmin && group.members.length > 1) {
        await prisma.systemLog.create({
          data: {
            userId,
            action: "DELETE_GROUP_ATTEMPT",
            entityType: "Group",
            entityId: groupId,
            description: "Thử xóa nhóm nhưng nhóm vẫn còn thành viên",
            severity: "WARNING",
            ipAddress: ipAddress || "unknown",
            metadata: { memberCount: group.members.length },
          },
        });
        throw new Error("Nhóm vẫn còn thành viên, chỉ graduation_thesis_manager hoặc academic_officer mới có thể xóa.");
      }

      const updatedGroup = await prisma.$transaction(async (tx) => {
        const updatedCounts = {
          reviewSchedules: 0,
          defenseSchedules: 0,
          defenseMemberResults: 0, // Thêm để đếm số bản ghi DefenseMemberResult bị xóa
          progressReports: 0,
          topicAssignments: 0,
          groupMentors: 0,
          groupInvitations: 0,
          groupMembers: 0,
          meetingSchedules: 0,
          documents: 0,
          topics: 0,
        };

        updatedCounts.reviewSchedules = await tx.reviewSchedule
          .updateMany({
            where: { groupId, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);

        const defenseScheduleIds = await tx.defenseSchedule
          .findMany({
            where: { groupId, isDeleted: false },
            select: { id: true },
          })
          .then((schedules) => schedules.map((s) => s.id));

        updatedCounts.defenseSchedules = await tx.defenseSchedule
          .updateMany({
            where: { groupId, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);

        updatedCounts.defenseMemberResults = await tx.defenseMemberResult
          .updateMany({
            where: { defenseScheduleId: { in: defenseScheduleIds }, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);

        updatedCounts.progressReports = await tx.progressReport
          .updateMany({
            where: { groupId, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);

        updatedCounts.topicAssignments = await tx.topicAssignment
          .updateMany({
            where: { groupId, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);

        updatedCounts.groupMentors = await tx.groupMentor
          .updateMany({
            where: { groupId, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);

        updatedCounts.groupInvitations = await tx.groupInvitation
          .updateMany({
            where: { groupId, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);

        updatedCounts.groupMembers = await tx.groupMember
          .updateMany({
            where: { groupId, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);

        updatedCounts.meetingSchedules = await tx.meetingSchedule
          .updateMany({
            where: { groupId, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);

        updatedCounts.documents = await tx.document
          .updateMany({
            where: { groupId, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);

        updatedCounts.topics = await tx.topic
          .updateMany({
            where: { proposedGroupId: groupId, isDeleted: false },
            data: { isDeleted: true },
          })
          .then((res) => res.count);

        await tx.group.update({
          where: { id: groupId },
          data: { isDeleted: true },
        });

        await tx.systemLog.create({
          data: {
            userId,
            action: "DELETE_GROUP",
            entityType: "Group",
            entityId: groupId,
            description: `Nhóm "${group.groupCode}" đã được đánh dấu xóa bởi ${isAdmin ? "admin" : "leader"}`,
            severity: "INFO",
            ipAddress: ipAddress || "unknown",
            metadata: {
              deletedByRole: isAdmin ? "admin" : "leader",
              groupCode: group.groupCode,
              memberCount: group.members.length,
              topicAssignmentsCount: group.topicAssignments.length,
              deletedDefenseMemberResultCount: updatedCounts.defenseMemberResults,
              updatedCounts,
            },
            oldValues: JSON.stringify(group),
          },
        });

        return await tx.group.findUnique({
          where: { id: groupId },
          include: { members: true, topicAssignments: true },
        });
      });

      return { message: "Nhóm đã được đánh dấu xóa thành công.", data: updatedGroup };
    } catch (error) {
      await prisma.systemLog.create({
        data: {
          userId,
          action: "DELETE_GROUP_ERROR",
          entityType: "Group",
          entityId: groupId,
          description: "Lỗi hệ thống khi đánh dấu xóa nhóm",
          severity: "ERROR",
          error: error instanceof Error ? error.message : "Unknown error",
          stackTrace: (error as Error).stack || "No stack trace",
          ipAddress: ipAddress || "unknown",
        },
      });
      throw error;
    }
  }
  // 12) leaveGroup
  async leaveGroup(groupId: string, userId: string) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new Error("Nhóm không tồn tại.");
    if (group.isLocked) throw new Error("Nhóm đã bị khóa. Không thể rời nhóm.");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("Người dùng không tồn tại.");

    const student = await prisma.student.findUnique({ where: { userId } });
    let member = null;
    if (student) {
      member = await prisma.groupMember.findFirst({
        where: { groupId, studentId: student.id },
      });
    }

    const isMentor = await prisma.groupMentor.findFirst({
      where: { groupId, mentorId: userId },
    });
    if (!member && !isMentor) throw new Error("Bạn không thuộc nhóm này.");

    if (member) {
      const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
      if (!leaderRole) throw new Error("Vai trò 'leader' không tồn tại.");
      if (member.roleId === leaderRole.id) {
        throw new Error("Leader không thể tự rời nhóm. Hãy đổi leader trước.");
      }
    }

    if (isMentor) {
      const mentorCount = await prisma.groupMentor.count({ where: { groupId } });
      if (mentorCount <= 1) {
        throw new Error("Bạn là mentor duy nhất, không thể rời nhóm. Hãy thay thế mentor trước.");
      }
    }

    if (member) await prisma.groupMember.delete({ where: { id: member.id } });
    if (isMentor) await prisma.groupMentor.delete({ where: { id: isMentor.id } });

    return { message: "Bạn đã rời nhóm thành công." };
  }

  // 13) cancelInvitation
  async cancelInvitation(invitationId: string, userId: string) {
    const invitation = await prisma.groupInvitation.findUnique({
      where: { id: invitationId },
      include: { group: true },
    });
    if (!invitation) throw new Error("Invitation không tồn tại.");
    if (invitation.status !== "PENDING") throw new Error("Lời mời không còn ở trạng thái PENDING, không thể hủy.");

    const groupId = invitation.groupId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new Error("Người dùng không tồn tại.");

    const userRoles = user.roles.map(r => r.role.name.toLowerCase());
    const isAdmin = userRoles.includes("admin");

    const student = await prisma.student.findUnique({ where: { userId } });
    let isLeader = false;
    if (student) {
      const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
      if (!leaderRole) throw new Error("Vai trò 'leader' không tồn tại.");
      const leader = await prisma.groupMember.findFirst({
        where: { groupId, studentId: student.id, roleId: leaderRole.id, isActive: true },
      });
      if (leader) isLeader = true;
    }

    if (!isAdmin && !isLeader) {
      throw new Error("Bạn không có quyền hủy lời mời (chỉ leader hoặc admin).");
    }

    await prisma.groupInvitation.update({
      where: { id: invitationId },
      data: { status: "CANCELLED" },
    });

    return { message: "Đã hủy lời mời thành công." };
  }

  // 14) listGroupInvitations
  async listGroupInvitations(groupId: string, userId: string) {
    // 1 Kiểm tra thông tin user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      console.error(`ERROR: Không tìm thấy user - userId=${userId}`);
      throw new Error("Người dùng không tồn tại.");
    }

    const userRoles = user.roles.map(r => r.role.name.toLowerCase());
    const isAdmin = userRoles.includes("admin");

    // 2 Kiểm tra xem user có phải leader của nhóm không
    const student = await prisma.student.findUnique({ where: { userId } });
    let isLeader = false;

    if (student) {
      const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
      if (!leaderRole) throw new Error("Vai trò 'leader' không tồn tại.");
      const leader = await prisma.groupMember.findFirst({
        where: { groupId, studentId: student.id, roleId: leaderRole.id, isActive: true },
      });
      if (leader) isLeader = true;
    }

    // 3 Nếu không phải admin hoặc leader -> từ chối
    if (!isAdmin && !isLeader) {
      console.error(`Người dùng không có quyền xem danh sách lời mời - userId=${userId}`);
      throw new Error("Bạn không có quyền xem danh sách lời mời (chỉ leader hoặc admin).");
    }

    // 4 Lấy danh sách lời mời
    const invitations = await prisma.groupInvitation.findMany({
      where: { groupId },
    });

    return invitations;
  }

  // 15) lockGroup
  async lockGroup(groupId: string, userId: string) {
    // 1 Kiểm tra thông tin user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });

    if (!user) throw new Error("Người dùng không tồn tại.");

    const userRoles = user.roles.map(r => r.role.name.toLowerCase());
    const isAdmin = userRoles.includes("admin");

    // 2 Kiểm tra xem user có phải leader của nhóm không
    const student = await prisma.student.findUnique({ where: { userId } });
    let isLeader = false;
    if (student) {
      const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
      if (!leaderRole) throw new Error("Vai trò 'leader' không tồn tại.");
      const leader = await prisma.groupMember.findFirst({
        where: { groupId, studentId: student.id, roleId: leaderRole.id, isActive: true },
      });
      if (leader) isLeader = true;
    }

    // 3 Kiểm tra user có phải mentor trong nhóm không
    const isMentor = await prisma.groupMentor.findFirst({
      where: { groupId, mentorId: userId },
    });

    // 4 Chỉ cho phép admin, leader hoặc mentor khóa nhóm
    if (!isAdmin && !isLeader && !isMentor) {
      throw new Error("Bạn không có quyền khóa nhóm (chỉ admin, leader hoặc mentor).");
    }

    // 5 Tìm group
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) throw new Error("Nhóm không tồn tại.");

    // 6 Nếu nhóm đã bị khóa, không cần cập nhật lại
    if (group.isLocked) {
      return { message: "Nhóm đã được khóa trước đó." };
    }

    // 7 Cập nhật trạng thái khóa nhóm
    await prisma.group.update({
      where: { id: groupId },
      data: { isLocked: true },
    });

    return { message: "Nhóm đã được khóa thành công." };
  }

  // 17) updateMentor
  async updateMentor(groupIdOrCode: string, oldMentorIdOrEmail: string, newMentorIdOrEmail: string, newMentorRole: string, userId: string, semesterId: string) {
    //  console.log(" Debug Inputs:", { groupIdOrCode, oldMentorIdOrEmail, newMentorIdOrEmail, newMentorRole, semesterId });

    if (!groupIdOrCode || !oldMentorIdOrEmail || !newMentorIdOrEmail || !newMentorRole) {
      throw new Error("Cần cung cấp đầy đủ thông tin.");
    }

    if (!["mentor_main", "mentor_sub"].includes(newMentorRole)) {
      throw new Error("Vai trò mới phải là 'mentor_main' hoặc 'mentor_sub'.");
    }

    //  Tìm nhóm bằng ID hoặc groupCode
    const group = await prisma.group.findFirst({
      where: {
        OR: [
          { id: groupIdOrCode },
          { groupCode: groupIdOrCode }
        ],
        semesterId
      }
    });

    if (!group) {
      throw new Error("Nhóm không tồn tại.");
    }

    // Tìm Mentor cũ bằng ID hoặc Email
    const oldMentor = await prisma.user.findFirst({
      where: {
        OR: [
          { id: oldMentorIdOrEmail },
          { email: oldMentorIdOrEmail }
        ]
      }
    });

    if (!oldMentor) {
      throw new Error("Mentor cũ không tồn tại.");
    }

    //  Tìm Mentor mới bằng ID hoặc Email
    const newMentor = await prisma.user.findFirst({
      where: {
        OR: [
          { id: newMentorIdOrEmail },
          { email: newMentorIdOrEmail }
        ]
      }
    });

    if (!newMentor) {
      throw new Error("Mentor mới không tồn tại.");
    }

    //  Kiểm tra mentor cũ có trong nhóm không
    const oldMentorInGroup = await prisma.groupMentor.findFirst({
      where: { groupId: group.id, mentorId: oldMentor.id }
    });

    if (!oldMentorInGroup) {
      throw new Error("Mentor cũ không thuộc nhóm.");
    }

    //  Lấy Role ID cho mentor_main hoặc mentor_sub trước khi sử dụng
    const mentorMainRole = await prisma.role.findUnique({ where: { name: "mentor_main" } });
    const mentorSubRole = await prisma.role.findUnique({ where: { name: "mentor_sub" } });

    if (!mentorMainRole || !mentorSubRole) {
      throw new Error("Vai trò 'mentor_main' hoặc 'mentor_sub' không tồn tại.");
    }

    const newMentorRoleId = newMentorRole === "mentor_main" ? mentorMainRole.id : mentorSubRole.id;

    //  Kiểm tra nếu mentor mới đã có trong nhóm
    const newMentorInGroup = await prisma.groupMentor.findFirst({
      where: { groupId: group.id, mentorId: newMentor.id }
    });

    //  Nếu mentor mới đã có trong nhóm, chỉ cập nhật role
    if (newMentorInGroup) {
      console.log("🟢 Mentor mới đã có trong nhóm, cập nhật role...");
      await prisma.groupMentor.update({
        where: { id: newMentorInGroup.id },
        data: { roleId: newMentorRoleId }
      });

      return { message: `Cập nhật vai trò thành ${newMentorRole} thành công.` };
    }

    //  Kiểm tra số lượng mentor
    const mentorCount = await prisma.groupMentor.count({ where: { groupId: group.id } });

    if (mentorCount <= 1 && oldMentorInGroup.roleId === mentorMainRole.id) {
      throw new Error("Không thể xóa mentor_main duy nhất. Hãy thêm mentor mới trước.");
    }

    //  Kiểm tra nếu đã có `mentor_main`, không cho thêm nữa
    if (newMentorRole === "mentor_main") {
      const existingMainMentor = await prisma.groupMentor.findFirst({
        where: { groupId: group.id, roleId: mentorMainRole.id }
      });

      if (existingMainMentor) {
        throw new Error("Nhóm đã có mentor_main. Vui lòng chuyển mentor_main hiện tại thành mentor_sub trước.");
      }
    }

    //  Xóa mentor cũ
    await prisma.groupMentor.delete({ where: { id: oldMentorInGroup.id } });

    //  Thêm mentor mới với vai trò đã chọn
    await prisma.groupMentor.create({
      data: {
        groupId: group.id,
        mentorId: newMentor.id,
        roleId: newMentorRoleId,
        addedBy: userId,
      },
    });

    return { message: `Mentor đã được cập nhật thành công với vai trò ${newMentorRole}.` };
  }

  // 18) getGroupMembers
  async getGroupMembers(groupId: string, userId: string) {
    console.log(`Bắt đầu getGroupMembers - groupId=${groupId}, userId=${userId}`);

    // 1️ Kiểm tra thông tin user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      console.error(`Không tìm thấy user - userId=${userId}`);
      throw new Error("Người dùng không tồn tại.");
    }

    const userRoles = user.roles.map(r => r.role.name.toLowerCase());
    const isAdmin = userRoles.includes("admin") || userRoles.includes("graduation_thesis_manager") || userRoles.includes("academic_officer");

    // 2 Kiểm tra xem user có phải leader của nhóm không
    const student = await prisma.student.findUnique({ where: { userId } });
    let isLeader = false;

    if (student) {
      const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
      if (!leaderRole) throw new Error("Vai trò 'leader' không tồn tại.");
      const leader = await prisma.groupMember.findFirst({
        where: { groupId, studentId: student.id, roleId: leaderRole.id, isActive: true },
      });
      if (leader) isLeader = true;
    }

    // 3 Nếu không phải admin hoặc leader -> từ chối
    if (!isAdmin && !isLeader) {
      console.error(`Người dùng không có quyền xem thành viên nhóm - userId=${userId}`);
      throw new Error("Bạn không có quyền xem thành viên nhóm (chỉ leader hoặc graduation_thesis_manager ,academic_officer , student ).");
    }

    // 4 Lấy danh sách thành viên nhóm
    const members = await prisma.groupMember.findMany({
      where: { groupId },
    });

    return members;
  }

  // 19) getGroupMentors
  async getGroupMentors(groupId: string) {
    const mentors = await prisma.groupMentor.findMany({
      where: { groupId },
      include: { mentor: { select: { id: true, fullName: true, email: true } } },
    });

    return mentors.map(m => ({
      mentorId: m.mentor.id,
      fullName: m.mentor.fullName,
      email: m.mentor.email,
    }));
  }

  // 20) unlockGroup
  async unlockGroup(groupId: string, userId: string) {
    // 1 Lấy thông tin user + vai trò
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });

    if (!user) throw new Error("Người dùng không tồn tại.");

    const userRoles = user.roles.map(r => r.role.name.toLowerCase());
    const isAdmin = userRoles.includes("admin");
    const isAcademicOfficer = userRoles.includes("academic_officer");

    // 2 Kiểm tra quyền mở khóa (chỉ admin hoặc academic_officer)
    if (!isAdmin && !isAcademicOfficer) {
      throw new Error("Bạn không có quyền mở khóa nhóm.");
    }

    // 3 Kiểm tra xem nhóm có bị khóa không
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) throw new Error("Nhóm không tồn tại.");
    if (!group.isLocked) {
      return { message: "Nhóm hiện không bị khóa." };
    }

    // 4 Mở khóa nhóm
    await prisma.group.update({
      where: { id: groupId },
      data: { isLocked: false },
    });

    return { message: "Nhóm đã được mở khóa thành công." };
  }
  // 21) createGroupByAcademicOfficer
  async createGroupByAcademicOfficer(input: { leaderEmail: string; semesterId: string; createdBy: string }) {
    const { leaderEmail, semesterId, createdBy } = input;

    try {
      if (!leaderEmail) {
        return { success: false, status: 400, message: "Email trưởng nhóm là bắt buộc." };
      }
      if (!semesterId) {
        return { success: false, status: 400, message: "Học kỳ là bắt buộc." };
      }
      if (!createdBy) {
        return { success: false, status: 400, message: "Thông tin người tạo nhóm không hợp lệ." };
      }

      const semester = await prisma.semester.findUnique({
        where: {
          id: semesterId,
          isDeleted: false
        },
        select: { id: true, startDate: true },
      });
      if (!semester) {
        return { success: false, status: 404, message: "Học kỳ không tồn tại." };
      }

      const leader = await prisma.student.findFirst({
        where: { user: { email: leaderEmail } },
        include: { user: true, major: true },
      });
      if (!leader || !leader.major) {
        return { success: false, status: 404, message: "Trưởng nhóm không tồn tại hoặc không có chuyên ngành." };
      }
      const majorName = leader.major.name;

      const studentSemester = await prisma.semesterStudent.findFirst({
        where: { studentId: leader.id, semesterId },
      });
      if (!studentSemester) {
        return { success: false, status: 400, message: "Trưởng nhóm không thuộc học kỳ này." };
      }

      if (studentSemester.qualificationStatus.trim().toLowerCase() !== "qualified") {
        return {
          success: false,
          status: 400,
          message: `Trưởng nhóm không đủ điều kiện tham gia nhóm. Trạng thái hiện tại: ${studentSemester.qualificationStatus}`
        };
      }

      const existingMember = await prisma.groupMember.findFirst({
        where: { studentId: leader.id, group: { semesterId }, isDeleted: false },
      });
      if (existingMember) {
        return { success: false, status: 400, message: "Trưởng nhóm đã thuộc một nhóm trong học kỳ này." };
      }

      const groupCode = await this.generateUniqueGroupCode(majorName, semesterId, semester.startDate);
      if (!groupCode) {
        return { success: false, status: 500, message: "Không thể tạo mã nhóm." };
      }

      const maxMembers = await systemConfigService.getMaxGroupMembers();
      if (maxMembers <= 0) {
        return { success: false, status: 500, message: "Số lượng thành viên tối đa không hợp lệ." };
      }

      const newGroup = await prisma.group.create({
        data: {
          groupCode,
          semesterId,
          status: "ACTIVE",
          createdBy,
          maxMembers,
          createdAt: nowVN(), // Thêm: Rõ ràng gán createdAt bằng nowVN()
        },
      });

      const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
      if (!leaderRole) {
        return { success: false, status: 500, message: "Vai trò 'leader' không tồn tại." };
      }

      await prisma.groupMember.create({
        data: {
          groupId: newGroup.id,
          studentId: leader.id,
          roleId: leaderRole.id,
          status: "ACTIVE",
          userId: leader.userId,
        },
      });

      return {
        success: true,
        status: 201,
        message: "Nhóm đã được tạo thành công.",
        data: newGroup,
      };
    } catch (error) {
      console.error("Lỗi khi tạo nhóm:", error);
      return { success: false, status: 500, message: "Lỗi hệ thống." };
    }
  }
  // 22) getStudentsWithoutGroupForStudent (by student)
  async getStudentsWithoutGroupForStudent(userId: string) {
    // Kiểm tra sinh viên hiện tại
    const currentStudent = await prisma.student.findUnique({
      where: { userId },
      include: {
        major: true,
        semesterStudents: {
          where: {
            semester: {
              isDeleted: false,
            },
          },
          include: {
            semester: true,
          },
        },
      },
    });

    if (!currentStudent) {
      throw new Error("Không tìm thấy thông tin sinh viên.");
    }

    const currentSemester = currentStudent.semesterStudents[0]?.semester;
    if (!currentSemester) {
      throw new Error("Không tìm thấy học kỳ hiện tại.");
    }

    // Truy vấn sinh viên chưa có nhóm và đủ điều kiện (isEligible từ SemesterStudent)
    const students = await prisma.student.findMany({
      where: {
        semesterStudents: {
          some: {
            semesterId: currentSemester.id,
            isEligible: true, // Điều kiện đủ điều kiện từ SemesterStudent
            semester: {
              isDeleted: false,
            },
          },
        },
        NOT: {
          groupMembers: {
            some: {
              group: {
                semesterId: currentSemester.id,
                isDeleted: false,
              },
            },
          },
        },
      },
      include: {
        user: true,
        major: true,
        specialization: true,
      },
    });

    // Định dạng dữ liệu trả về
    return students.map((student) => ({
      id: student.id,
      studentCode: student.studentCode,
      studentName: student.user?.username || "",
      email: student.user?.email || "",
      major: student.major?.name || "",
      specialization: student.specialization?.name || "",
    }));
  }

  // 23) // Mentor thay đổi status của member trong học kì 
  async toggleMemberStatusByMentor(
    groupIdentifier: { groupId?: string; groupCode?: string },
    memberIdentifier: { memberId?: string; memberEmail?: string },
    newStatus: "ACTIVE" | "INACTIVE",
    mentorId: string
  ) {
    try {
      const group = await prisma.group.findFirst({
        where: {
          OR: [
            ...(groupIdentifier.groupId ? [{ id: groupIdentifier.groupId }] : []),
            ...(groupIdentifier.groupCode ? [{ groupCode: groupIdentifier.groupCode }] : []),
          ],
        },
        include: {
          semester: true,
        },
      });
      if (!group) {
        throw new Error("Nhóm không tồn tại.");
      }

      const currentDate = nowVN(); // Sửa: Dùng nowVN()
      const startDate = new Date(group.semester.startDate);
      const endDate = group.semester.endDate ? new Date(group.semester.endDate) : new Date(8640000000000000);
      let effectiveStatus = group.semester.status;
      if (currentDate < startDate) effectiveStatus = "UPCOMING";
      else if (currentDate >= startDate && currentDate <= endDate) effectiveStatus = "ACTIVE";
      else if (currentDate > endDate) effectiveStatus = "COMPLETE";

      if (effectiveStatus === "COMPLETE") {
        throw new Error("Không thể thay đổi trạng thái thành viên trong học kỳ đã hoàn thành.");
      }

      const mentorInGroup = await prisma.groupMentor.findFirst({
        where: { groupId: group.id, mentorId },
      });
      if (!mentorInGroup) {
        throw new Error("Bạn không phải là mentor của nhóm này.");
      }

      const member = await prisma.groupMember.findFirst({
        where: {
          groupId: group.id,
          OR: [
            ...(memberIdentifier.memberId ? [{ studentId: memberIdentifier.memberId }] : []),
            ...(memberIdentifier.memberEmail
              ? [{ student: { user: { email: memberIdentifier.memberEmail } } }]
              : []),
          ],
        },
        include: {
          role: true,
          student: {
            include: {
              user: true,
            },
          },
        },
      });
      if (!member) {
        throw new Error("Thành viên không tồn tại trong nhóm.");
      }

      if (member.role.name.toLowerCase() === "leader") {
        throw new Error("Không thể thay đổi trạng thái của trưởng nhóm. Hãy thay đổi leader trước.");
      }

      if (member.status === newStatus) {
        return {
          success: true,
          status: HTTP_STATUS.OK,
          message: `Thành viên đã ở trạng thái ${newStatus}. Không cần thay đổi.`,
        };
      }

      const updatedMember = await prisma.groupMember.update({
        where: { id: member.id },
        data: { status: newStatus },
        select: {
          studentId: true,
          status: true,
          isActive: true,
        },
      });

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: `Trạng thái của thành viên đã được cập nhật thành ${newStatus} thành công.`,
        data: {
          studentId: updatedMember.studentId,
          email: member.student?.user?.email || null,
          status: updatedMember.status,
          role: member.role.name,
          isActive: updatedMember.isActive,
        },
      };
    } catch (error) {
      console.error("Lỗi khi thay đổi trạng thái thành viên:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message:
          error instanceof Error
            ? error.message
            : "Lỗi hệ thống khi thay đổi trạng thái thành viên.",
      };
    }
  }


  async getMyGroups(userId: string) {
    try {
      // Tìm thông tin sinh viên dựa trên userId
      const student = await prisma.student.findUnique({
        where: {
          userId,
          isDeleted: false,
        },
        select: {
          id: true,
        },
      });

      if (!student) {
        throw new Error("Không tìm thấy sinh viên.");
      }

      // Truy vấn tất cả nhóm mà sinh viên tham gia
      const groups = await prisma.group.findMany({
        where: {
          members: {
            some: {
              studentId: student.id,
              isDeleted: false,
            },
          },
          isDeleted: false,
        },
        select: {
          // Lấy toàn bộ các trường của Group
          id: true,
          groupCode: true,
          semesterId: true,
          status: true,
          isAutoCreated: true,
          createdBy: true,
          maxMembers: true,
          isMultiMajor: true,
          createdAt: true,
          updatedAt: true,
          isLocked: true,
          // Thông tin quan hệ
          semester: {
            select: {
              code: true,
              startDate: true,
              endDate: true,
            },
          },
          members: {
            where: { isDeleted: false },
            select: {
              studentId: true,
              status: true,
              role: {
                select: {
                  name: true,
                },
              },
              student: {
                select: {
                  user: {
                    select: {
                      fullName: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
          creator: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          mentors: {
            where: { isDeleted: false },
            select: {
              mentorId: true,
              role: {
                select: {
                  name: true,
                },
              },
              mentor: {
                select: {
                  username: true,
                  email: true,
                },
              },
            },
          },
          topicAssignments: {
            where: { isDeleted: false },
            select: {
              topicId: true,
              status: true,
              defendStatus: true,
              defenseRound: true,
              topic: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      // Format dữ liệu trả về
      const formattedGroups = groups.map((group) => ({
        group: {
          id: group.id,
          groupCode: group.groupCode,
          semesterId: group.semesterId,
          status: group.status,
          isAutoCreated: group.isAutoCreated,
          createdBy: group.createdBy,
          maxMembers: group.maxMembers,
          isMultiMajor: group.isMultiMajor,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt,
          isLocked: group.isLocked,
        },
        semester: {
          code: group.semester.code,
          startDate: group.semester.startDate,
          endDate: group.semester.endDate,
        },
        members: group.members.map((member) => ({
          studentId: member.studentId,
          fullName: member.student?.user?.fullName ?? "Không có tên",
          email: member.student?.user?.email ?? "Không có email",
          role: member.role.name,
          status: member.status,
        })),
        creator: {
          id: group.creator.id,
          fullName: group.creator.fullName ?? "Không có tên",
          email: group.creator.email ?? "Không có email",
        },
        mentors: group.mentors.map((mentor) => ({
          mentorId: mentor.mentorId,
          username: mentor.mentor.username ?? "Không có tên",
          email: mentor.mentor.email ?? "Không có email",
          role: mentor.role.name,
        })),
        topicAssignments: group.topicAssignments.map((assignment) => ({
          topicId: assignment.topicId,
          topicName: assignment.topic.name,
          status: assignment.status,
          defendStatus: assignment.defendStatus,
          defenseRound: assignment.defenseRound,
        })),
      }));

      return formattedGroups;
    } catch (error) {
      console.error("Lỗi trong getMyGroups:", error);
      throw error;
    }
  }
}