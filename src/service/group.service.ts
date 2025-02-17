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
    // 🔍 Kiểm tra nhóm có tồn tại không
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

    //  Kiểm tra ngành học nếu nhóm đã có thành viên
    if (group.members.length > 0) {
      const groupMajor = group.members[0].student.major?.id; // ✅ Sử dụng Optional Chaining
      if (student.major?.id !== groupMajor) {
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


async randomizeGroups(semesterId: string, createdBy: string) {
  // Lấy danh sách sinh viên đủ điều kiện, chưa có nhóm
  const students = await prisma.student.findMany({
      where: {
          semesterStudents: {
              some: { semesterId, qualificationStatus: "qualified" },
          },
          groupMembers: { none: {} }, // Không có nhóm
      },
      include: { user: true, major: true, specialization: true },
  });

  if (students.length === 0) {
      throw new Error("Không có sinh viên nào đủ điều kiện để tạo nhóm.");
  }

  //  Phân loại theo chuyên môn (FE, BE, FS)
  let feStudents = students.filter(s => s.specialization?.name === "Frontend");
  let beStudents = students.filter(s => s.specialization?.name === "Backend");
  let fsStudents = students.filter(s => s.specialization?.name === "Fullstack");

  let groups: any[] = [];
  let groupCounter = 1;

  while (students.length > 0) {
      let groupMembers = [];

      //  Cố gắng lấy 2 FE, 2 BE, nếu có thể thêm 1 FS
      if (feStudents.length > 0) groupMembers.push(feStudents.pop());
      if (beStudents.length > 0) groupMembers.push(beStudents.pop());
      if (feStudents.length > 0) groupMembers.push(feStudents.pop());
      if (beStudents.length > 0) groupMembers.push(beStudents.pop());
      if (fsStudents.length > 0 && groupMembers.length < 5) groupMembers.push(fsStudents.pop());

      //  Nếu nhóm chưa đủ 4, lấy ngẫu nhiên từ sinh viên còn lại
      while (groupMembers.length < 4 && students.length > 0) {
          groupMembers.push(students.pop());
      }

      //  Nếu nhóm chưa đạt tối thiểu 4 thành viên, bỏ qua nhóm này
      if (groupMembers.length < 4) break;

  
      const newGroup = await prisma.group.create({
          data: {
              groupCode: `G-${groupCounter++}-${Date.now()}`,
              semesterId,
              status: "ACTIVE",
              createdBy,
              maxMembers: 5,
              isAutoCreated: true,
              members: {
                  create: groupMembers.map((member, index) => ({
                      studentId: member!.id,
                      role: index === 0 ? "leader" : "member",
                      status: "ACTIVE",
                  })),
              },
          },
          include: { members: true },
      });

      groups.push(newGroup);
  }

  return { message: "Random nhóm thành công!", data: groups };
}

}
