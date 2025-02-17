import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../utils/email";
import { MESSAGES } from "../constants/message";

const prisma = new PrismaClient();

export class GroupService {
  [x: string]: any;
 
  async createGroup(leaderId: string, semesterId: string) {
    const leader = await prisma.student.findUnique({ where: { userId: leaderId } });
    if (!leader) throw new Error(MESSAGES.STUDENT.STUDENT_NOT_FOUND);

    // Tạo nhóm mới
    const newGroup = await prisma.group.create({
      data: {
        groupCode: `G-${Date.now()}`,
        semesterId,
        status: "ACTIVE",
        createdBy: leaderId,
        maxMembers: 5,
        isAutoCreated: false,
        members: {
          create: [{
              studentId: leader.id,
              role: "LEADER",
              status: "ACTIVE"
          }],
        },
      },
      include: { members: true },
    });

    return { message: MESSAGES.GROUP.GROUP_CREATED, data: newGroup };
  }

 
  async inviteMember(groupId: string, studentId: string, invitedById: string) {
    // Kiểm tra nhóm có tồn tại không
    const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: { members: true },
    });

    if (!group) throw new Error(MESSAGES.GROUP.GROUP_NOT_FOUND);
    if (group.members.length >= 5) throw new Error(MESSAGES.GROUP.GROUP_FULL);
    if (group.members.some((m) => m.studentId === studentId)) {
        throw new Error(MESSAGES.GROUP.MEMBER_ALREADY_EXISTS);
    }

    // Kiểm tra nếu đã có lời mời trước đó
    const existingInvitation = await prisma.groupInvitation.findFirst({
        where: { groupId, studentId, status: "PENDING" },
    });

    if (existingInvitation) throw new Error(MESSAGES.GROUP.INVITATION_EXISTS);

    // Tạo lời mời mới
    const invitation = await prisma.groupInvitation.create({
        data: { groupId, studentId, status: "PENDING" },
    });

    // Gửi email mời sinh viên
    const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: { user: true },
    });

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

}
