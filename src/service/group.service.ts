import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../utils/email";
import { MESSAGES } from "../constants/message";
import { ConfigService } from "./config.service";
import { AuthenticatedRequest } from "~/middleware/user.middleware";
import { Response } from "express";
const prisma = new PrismaClient();

export class GroupService {
  [x: string]: any;

  async createGroup(leaderId: string, semesterId: string) {
    // 1Lấy thông tin leader, bao gồm ngành (major.name)
    const leader = await prisma.student.findUnique({
      where: { userId: leaderId },
      include: { major: true } // Để lấy tên ngành (major.name)
    });
    if (!leader) throw new Error("Không tìm thấy sinh viên.");

    //  Lấy 2 số cuối của năm hiện tại
    const currentYear = new Date().getFullYear();
    const lastTwoDigits = currentYear.toString().slice(-2); // Ví dụ: 2025 → "25"

    // 3️ Tạo mã ngành từ tên ngành (cắt chuỗi)
    const majorName = (leader.major?.name || "").trim(); // Ví dụ: "Software Engineering"
    // Tách theo khoảng trắng, lấy ký tự đầu của 2 từ đầu
    let majorCode = "";
    const words = majorName.split(/\s+/); // Tách theo khoảng trắng

    if (words.length >= 2) {
      // Nếu có >= 2 từ, lấy ký tự đầu mỗi từ, ví dụ "Software" + "Engineering" => "SE"
      majorCode =
        words[0].charAt(0).toUpperCase() + words[1].charAt(0).toUpperCase();
    } else {
      // Nếu chỉ có 1 từ hoặc rỗng, lấy 2 ký tự đầu
      majorCode = majorName.slice(0, 2).toUpperCase() || "XX";
    }

    // Fallback nếu vẫn rỗng
    if (!majorCode) {
      majorCode = "XX";
    }

    //4️ Tạo tiền tố cho mã nhóm
    //    "G" + 2 số cuối năm + 2 ký tự từ ngành
    const groupCodePrefix = `G${lastTwoDigits}${majorCode}`;

    // 5️ Đếm số nhóm hiện có với tiền tố này để xác định số thứ tự
    const count = await prisma.group.count({
      where: {
        semesterId,
        groupCode: { startsWith: groupCodePrefix }
      }
    });
    const sequenceNumber = (count + 1).toString().padStart(3, "0"); // Ví dụ: "005"

    // 6️ Ghép thành mã nhóm hoàn chỉnh
    const groupCode = groupCodePrefix + sequenceNumber; // "G25SE005"

    // 7️ Tạo nhóm mới
    const newGroup = await prisma.group.create({
      data: {
        groupCode,
        semesterId,
        status: "ACTIVE",
        createdBy: leaderId,
        maxMembers: 5, // Giá trị mặc định
        isAutoCreated: false,
        members: {
          create: [
            {
              studentId: leader.id,
              role: "leader",
              status: "ACTIVE"
            }
          ]
        }
      },
      include: { members: true }
    });

    return {
      message: "Nhóm đã được tạo thành công.",
      data: newGroup
    };
  }



  async inviteMember(groupId: string, studentId: string, invitedById: string) {
    //  Kiểm tra nhóm có tồn tại không
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: { student: { include: { major: true } } }
        }
      }, //  Lấy thông tin ngành của thành viên trong nhóm
    });

    if (!group) throw new Error(MESSAGES.GROUP.GROUP_NOT_FOUND);
    if (group.members.length >= 5) throw new Error(MESSAGES.GROUP.GROUP_FULL);
    if (group.members.some((m) => m.studentId === studentId)) {
      throw new Error(MESSAGES.GROUP.MEMBER_ALREADY_EXISTS);
    }

    //  Lấy thông tin sinh viên cần mời (gồm ngành học)
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true, major: true },
    });

    if (!student) throw new Error("Không tìm thấy sinh viên.");

    //  Kiểm tra điều kiện của sinh viên trong học kỳ
    const studentSemester = await prisma.semesterStudent.findFirst({
      where: { studentId: studentId, semesterId: group.semesterId }
    });

    if (!studentSemester || studentSemester.qualificationStatus !== "qualified") {
      throw new Error("Sinh viên không đủ điều kiện tham gia nhóm.");
    }

    if (group.members.length > 0) {
      const groupMajor = group.members[0]?.student?.major?.id;
      if (student.major?.id && groupMajor && student.major.id !== groupMajor) {
        throw new Error(`Sinh viên thuộc ngành khác (${student.major?.name}), không thể tham gia nhóm.`);
      }
    }

    //  Kiểm tra nếu đã có lời mời trước đó
    const existingInvitation = await prisma.groupInvitation.findFirst({
      where: { groupId, studentId, status: "PENDING" },
    });

    if (existingInvitation) throw new Error(MESSAGES.GROUP.INVITATION_EXISTS);

    //  Tạo lời mời mới
    const invitation = await prisma.groupInvitation.create({
      data: { groupId, studentId, status: "PENDING" },
    });

    //  Gửi email mời sinh viên
    if (student?.user?.email) {
      const invitationLink = `http://160.187.241.152:6969/api/groups/accept-invitation/${invitation.id}`;

      const emailContent = `
        <p>Xin chào ${student.user.fullName || student.user.username},</p>
        <p>Bạn đã được mời tham gia nhóm ${group.groupCode}. Click vào đường link bên dưới để chấp nhận lời mời:</p>
        <a href="${invitationLink}">Chấp nhận lời mời</a>
        `;

      try {
        await sendEmail({
          to: student.user.email,
          subject: "Lời mời tham gia nhóm",
          html: emailContent,
        });

        await prisma.emailLog.create({
          data: {
            userId: invitedById,
            recipientEmail: student.user.email,
            subject: "Lời mời tham gia nhóm",
            content: emailContent,
            status: "SENT",
            errorAt: new Date(),
          },
        });

      } catch (error) {
        await prisma.emailLog.create({
          data: {
            userId: invitedById,
            recipientEmail: student.user.email,
            subject: "Lời mời tham gia nhóm",
            content: emailContent,
            status: "FAILED",
            errorMessage: (error as Error).message,
            errorAt: new Date(),
          },
        });

        console.error(` Lỗi gửi email cho ${student.user.email}:`, error);
      }
    }

    return { message: MESSAGES.GROUP.INVITATION_SENT, data: invitation };
  }


  async respondToInvitation(invitationId: string, userId: string, response: "ACCEPTED" | "REJECTED") {
    // Lấy studentId từ userId
    const student = await prisma.student.findUnique({
      where: { userId: userId },
      select: { id: true } // Lấy ID của student
    });

    if (!student) {
      throw new Error(MESSAGES.USER.UNAUTHORIZED);
    }

    // Kiểm tra lời mời
    const invitation = await prisma.groupInvitation.findUnique({
      where: { id: invitationId },
      include: { group: true },
    });

    if (!invitation) throw new Error(MESSAGES.GROUP.INVITATION_NOT_FOUND);
    if (invitation.studentId !== student.id) throw new Error(MESSAGES.USER.UNAUTHORIZED);

    // Cập nhật trạng thái lời mời
    const updatedInvitation = await prisma.groupInvitation.update({
      where: { id: invitationId },
      data: { status: response, respondedAt: new Date() },
    });

    // Nếu chấp nhận lời mời, thêm vào nhóm
    if (response === "ACCEPTED") {
      await prisma.groupMember.create({
        data: {
          groupId: invitation.groupId,
          studentId: student.id,
          role: "MEMBER",
          status: "ACTIVE",
        },
      });

      return { message: MESSAGES.GROUP.INVITATION_ACCEPTED, data: updatedInvitation };
    }

    return { message: MESSAGES.GROUP.INVITATION_REJECTED, data: updatedInvitation };
  }

  async getGroupInfo(groupId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            student: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });
    return group;
  }

  async getInvitationById(invitationId: string) {
    return await prisma.groupInvitation.findUnique({
      where: { id: invitationId },
    });
  }

  async forceAcceptInvitation(invitationId: string, studentId: string, p0: string) {
    // Kiểm tra lời mời có tồn tại không
    const invitation = await prisma.groupInvitation.findUnique({
      where: { id: invitationId },
      include: { group: true },
    });

    if (!invitation) throw new Error("Lời mời không tồn tại.");
    if (invitation.status !== "PENDING") throw new Error("Lời mời đã được xử lý hoặc hết hạn.");

    // Chấp nhận lời mời mà không cần xác thực `userId`
    await prisma.groupInvitation.update({
      where: { id: invitationId },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });

    // Thêm sinh viên vào nhóm
    await prisma.groupMember.create({
      data: {
        groupId: invitation.groupId,
        studentId: invitation.studentId,
        role: "MEMBER",
        status: "ACTIVE",
      },
    });

    return { message: "Lời mời đã được chấp nhận." };
  }

  async getGroupsBySemester(semesterId: string, userId: string) {
    // Lấy thông tin user + roles
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } }
    });

    if (!user) throw new Error("Người dùng không tồn tại.");

    // Lấy danh sách role của user
    const userRoles = user.roles.map(r => r.role.name.toLowerCase());

    // Nếu user có quyền admin → Xem tất cả nhóm
    if (userRoles.includes("graduation_thesis_manager") || userRoles.includes("admin")) {
      return await prisma.group.findMany({
        where: { semesterId },
        include: {
          members: {
            include: { student: { include: { user: true } } }
          }
        }
      });
    }

    // Nếu user là sinh viên → Chỉ xem nhóm của họ
    if (userRoles.includes("student")) {
      const student = await prisma.student.findUnique({
        where: { userId },
        select: { id: true }
      });

      if (!student) throw new Error("Không tìm thấy sinh viên.");

      return await prisma.group.findMany({
        where: {
          semesterId,
          members: { some: { studentId: student.id } }
        },
        include: {
          members: {
            include: { student: { include: { user: true } } }
          }
        }
      });
    }

    // Nếu user là giảng viên hoặc mentor → Xem nhóm do họ hướng dẫn
    if (userRoles.includes("lecturer") || userRoles.includes("mentor")) {
      return await prisma.group.findMany({
        where: {
          semesterId,
          OR: [
            { mentor1Id: userId },
            { mentor2Id: userId }
          ]
        },
        include: {
          members: {
            include: { student: { include: { user: true } } }
          }
        }
      });
    }

    throw new Error("Bạn không có quyền truy cập danh sách nhóm.");
  }


  async getStudentsWithoutGroup(semesterId: string) {
    const studentsWithoutGroup = await prisma.student.findMany({
      where: {
        semesterStudents: {
          some: { semesterId }
        },
        groupMembers: { none: {} }
      },
      include: {
        user: true,
        major: true,
        specialization: true,
      }
    });

    return studentsWithoutGroup;
  }



  static async changeLeader(groupId: string, newLeaderId: string, userId: string) {
    // Kiểm tra quyền
    await this.checkLeaderOrMentor(userId, groupId);

    // Kiểm tra nhóm
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) throw new Error("Nhóm không tồn tại.");

    // Kiểm tra leader hiện tại
    const currentLeader = group.members.find(m => m.role === "leader");
    if (!currentLeader) throw new Error("Nhóm chưa có leader.");

    // Kiểm tra leader mới có trong nhóm không
    const newLeader = group.members.find(m => m.studentId === newLeaderId);
    if (!newLeader) throw new Error("Sinh viên này không thuộc nhóm.");

    // Cập nhật leader mới
    await prisma.groupMember.updateMany({
      where: { groupId },
      data: { role: "member" },
    });

    await prisma.groupMember.update({
      where: { id: newLeader.id },
      data: { role: "leader" },
    });

    return { message: "Leader đã được thay đổi thành công." };
  }

  static async addMentorToGroup(groupId: string, mentorId: string, userId: string) {
    // 1️ Kiểm tra quyền Admin
    await this.checkAdmin(userId);

    // 2️ Kiểm tra mentor có tồn tại không (Lấy từ bảng `user`)
    const mentor = await prisma.user.findUnique({
      where: { id: mentorId },
      include: { roles: { include: { role: true } } }
    });

    if (!mentor) throw new Error("Mentor không tồn tại.");

    // 3️ Kiểm tra Mentor có role "mentor" không
    const isMentor = mentor.roles.some(r => r.role.name === "mentor");
    if (!isMentor) throw new Error("Người dùng này không phải Mentor.");

    // 4️ Kiểm tra Mentor đã có trong nhóm chưa (Dùng `userId` thay vì `mentorId`)
    const isAlreadyMentor = await prisma.groupMember.findFirst({
      where: { groupId, userId: mentorId, role: "mentor" }
    });

    if (isAlreadyMentor) throw new Error("Mentor đã có trong nhóm.");

    // 5️Thêm Mentor vào nhóm (Dùng `userId` thay vì `studentId`)
    await prisma.groupMember.create({
      data: {
        groupId,
        userId: mentorId,
        role: "mentor",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });

    return { message: "Mentor đã được thêm vào nhóm thành công." };
  }

  static async removeMemberFromGroup(groupId: string, memberId: string, userId: string) {
    // 1️ Kiểm tra quyền Leader, Mentor hoặc Admin
    await this.checkLeaderOrMentor(userId, groupId);

    // 2️ Kiểm tra thành viên có tồn tại trong nhóm không (Lưu ý: `userId` dùng thay vì `studentId`)
    const member = await prisma.groupMember.findFirst({
      where: { groupId, userId: memberId },
    });

    if (!member) throw new Error("Thành viên không tồn tại trong nhóm.");

    //  3️ Không cho phép leader tự xoá chính mình khỏi nhóm
    if (member.role === "leader" && member.userId === userId) {
      throw new Error("Leader không thể tự xoá chính mình khỏi nhóm.");
    }

    //  4️ Nếu là mentor, chỉ admin mới có quyền xoá
    if (member.role === "mentor") {
      const isAdmin = await this.checkAdmin(userId, false);
      if (!isAdmin) throw new Error("Chỉ admin mới có quyền xoá mentor.");
    }

    //  5️Xoá thành viên khỏi nhóm
    await prisma.groupMember.delete({ where: { id: member.id } });

    return { message: "Xoá thành viên khỏi nhóm thành công." };
  }


  static async deleteGroup(groupId: string, userId: string) {
    // Kiểm tra quyền
    await this.checkLeaderOrMentor(userId, groupId);

    // Kiểm tra nhóm
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) throw new Error("Nhóm không tồn tại.");

    // Nếu không phải admin, không cho xoá nhóm có thành viên
    const isAdmin = await this.checkAdmin(userId, false);
    if (!isAdmin && group.members.length > 0) {
      throw new Error("Nhóm vẫn còn thành viên, chỉ admin mới có thể xoá.");
    }

    // Xoá nhóm
    await prisma.groupMember.deleteMany({ where: { groupId } });
    await prisma.group.delete({ where: { id: groupId } });

    return { message: "Nhóm đã được xoá thành công." };
  }

  //  Kiểm tra quyền
  static async checkAdmin(userId: string, throwError = true) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { select: { role: true } } },
    });

    const isAdmin = user?.roles.some(r => r.role.name === "admin");

    if (!isAdmin && throwError) throw new Error("Bạn không có quyền admin.");

    return isAdmin;
  }

  static async checkLeaderOrMentor(userId: string, groupId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { select: { role: true } } },
    });

    if (!user) throw new Error("Người dùng không tồn tại.");

    if (user.roles.some(r => r.role.name === "admin")) return true;

    const membership = await prisma.groupMember.findFirst({
      where: { groupId, studentId: userId, role: { in: ["leader", "mentor"] } },
    });

    if (!membership) throw new Error("Bạn không có quyền thực hiện thao tác này.");

    return true;
  }
}


