import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../utils/email";
import { MESSAGES } from "../constants/message";


const prisma = new PrismaClient();

export class GroupService {
  // 1) Tạo nhóm
  async createGroup(leaderId: string, semesterId: string) {
    const leader = await prisma.student.findUnique({
      where: { userId: leaderId },
      include: { major: true },
    });
    if (!leader) throw new Error("Không tìm thấy sinh viên.");

    const currentYear = new Date().getFullYear();
    const lastTwoDigits = currentYear.toString().slice(-2);

    const majorName = (leader.major?.name || "").trim();
    let majorCode = "";
    const words = majorName.split(/\s+/);

    if (words.length >= 2) {
      majorCode =
        words[0].charAt(0).toUpperCase() + words[1].charAt(0).toUpperCase();
    } else {
      majorCode = majorName.slice(0, 2).toUpperCase() || "XX";
    }
    if (!majorCode) {
      majorCode = "XX";
    }

    const groupCodePrefix = `G${lastTwoDigits}${majorCode}`;
    const count = await prisma.group.count({
      where: {
        semesterId,
        groupCode: { startsWith: groupCodePrefix },
      },
    });
    const sequenceNumber = (count + 1).toString().padStart(3, "0");
    const groupCode = groupCodePrefix + sequenceNumber; // Ví dụ: "G25SE005"

    const newGroup = await prisma.group.create({
      data: {
        groupCode,
        semesterId,
        status: "ACTIVE",
        createdBy: leaderId,
        maxMembers: 5, // default
        isAutoCreated: false,
        members: {
          create: [
            {
              studentId: leader.id,
              role: "leader",
              status: "ACTIVE",
            },
          ],
        },
      },
      include: { members: true },
    });

    return {
      message: "Nhóm đã được tạo thành công.",
      data: newGroup,
    };
  }

  // 2) Mời thành viên
  async inviteMember(groupId: string, studentId: string, invitedById: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: { student: { include: { major: true } } },
        },
      },
    });
    if (!group) throw new Error(MESSAGES.GROUP.GROUP_NOT_FOUND);
    if (group.members.length >= 5) throw new Error(MESSAGES.GROUP.GROUP_FULL);
    if (group.members.some((m) => m.studentId === studentId)) {
      throw new Error(MESSAGES.GROUP.MEMBER_ALREADY_EXISTS);
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true, major: true },
    });
    if (!student) throw new Error("Không tìm thấy sinh viên.");

    // Kiểm tra điều kiện trong học kỳ
    const studentSemester = await prisma.semesterStudent.findFirst({
      where: { studentId, semesterId: group.semesterId },
    });
    if (!studentSemester || studentSemester.qualificationStatus !== "qualified") {
      throw new Error("Sinh viên không đủ điều kiện tham gia nhóm.");
    }

    // Kiểm tra ngành khác nhau?
    if (group.members.length > 0) {
      const groupMajor = group.members[0]?.student?.major?.id;
      if (student.major?.id && groupMajor && student.major.id !== groupMajor) {
        throw new Error(
          `Sinh viên thuộc ngành khác (${student.major?.name}), không thể tham gia nhóm.`
        );
      }
    }

    // Kiểm tra lời mời cũ
    const existingInvitation = await prisma.groupInvitation.findFirst({
      where: { groupId, studentId, status: "PENDING" },
    });
    if (existingInvitation) throw new Error(MESSAGES.GROUP.INVITATION_EXISTS);

    // Tạo lời mời
    const invitation = await prisma.groupInvitation.create({
      data: { groupId, studentId, status: "PENDING" },
    });

    // Gửi email
    if (student?.user?.email) {
      const invitationLink = `http://160.187.241.152:6969/api/groups/accept-invitation/${invitation.id}`;
      const emailContent = `
        <p>Xin chào ${
          student.user.fullName || student.user.username
        },</p>
        <p>Bạn đã được mời tham gia nhóm ${
          group.groupCode
        }. Click vào đường link bên dưới để chấp nhận lời mời:</p>
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
        console.error(`Lỗi gửi email cho ${student.user.email}:`, error);
      }
    }

    return { message: MESSAGES.GROUP.INVITATION_SENT, data: invitation };
  }

  // 3) Phản hồi lời mời
  async respondToInvitation(
    invitationId: string,
    userId: string,
    response: "ACCEPTED" | "REJECTED"
  ) {
    // Lấy studentId từ userId
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!student) {
      throw new Error(MESSAGES.USER.UNAUTHORIZED);
    }

    const invitation = await prisma.groupInvitation.findUnique({
      where: { id: invitationId },
      include: { group: true },
    });
    if (!invitation) throw new Error(MESSAGES.GROUP.INVITATION_NOT_FOUND);
    if (invitation.studentId !== student.id) {
      throw new Error(MESSAGES.USER.UNAUTHORIZED);
    }

    const updatedInvitation = await prisma.groupInvitation.update({
      where: { id: invitationId },
      data: { status: response, respondedAt: new Date() },
    });

    // Nếu chấp nhận => thêm vào group
    if (response === "ACCEPTED") {
      await prisma.groupMember.create({
        data: {
          groupId: invitation.groupId,
          studentId: student.id,
          role: "MEMBER",
          status: "ACTIVE",
        },
      });

      return {
        message: MESSAGES.GROUP.INVITATION_ACCEPTED,
        data: updatedInvitation,
      };
    }

    return { message: MESSAGES.GROUP.INVITATION_REJECTED, data: updatedInvitation };
  }

  // 4) Lấy thông tin nhóm
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

  // Lấy thông tin lời mời
  async getInvitationById(invitationId: string) {
    return await prisma.groupInvitation.findUnique({
      where: { id: invitationId },
    });
  }

  // forceAcceptInvitation (chấp nhận lời mời qua link - không cần token)
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
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });

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

  // 5) Lấy danh sách nhóm của 1 học kỳ, tùy role
  async getGroupsBySemester(semesterId: string, userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new Error("Người dùng không tồn tại.");

    const userRoles = user.roles.map((r) => r.role.name.toLowerCase());

    // Admin, Manager => xem tất cả
    if (
      userRoles.includes("graduation_thesis_manager") ||
      userRoles.includes("admin")
    ) {
      return await prisma.group.findMany({
        where: { semesterId },
        include: {
          members: {
            include: { student: { include: { user: true } } },
          },
        },
      });
    }

    // Student => chỉ xem nhóm của chính mình
    if (userRoles.includes("student")) {
      const student = await prisma.student.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!student) throw new Error("Không tìm thấy sinh viên.");

      return await prisma.group.findMany({
        where: {
          semesterId,
          members: { some: { studentId: student.id } },
        },
        include: {
          members: {
            include: { student: { include: { user: true } } },
          },
        },
      });
    }

    // Lecturer/Mentor => xem nhóm do họ hướng dẫn
    if (userRoles.includes("lecturer") || userRoles.includes("mentor")) {
      return await prisma.group.findMany({
        where: {
          semesterId,
          OR: [{ mentor1Id: userId }, { mentor2Id: userId }],
        },
        include: {
          members: {
            include: { student: { include: { user: true } } },
          },
        },
      });
    }

    throw new Error("Bạn không có quyền truy cập danh sách nhóm.");
  }

  // 6) Lấy danh sách sinh viên chưa có nhóm
  async getStudentsWithoutGroup(semesterId: string) {
    const studentsWithoutGroup = await prisma.student.findMany({
      where: {
        semesterStudents: {
          some: { semesterId },
        },
        groupMembers: { none: {} },
      },
      include: {
        user: true,
        major: true,
        specialization: true,
      },
    });

    return studentsWithoutGroup;
  }

  async randomizeGroups(semesterId: string, createdBy: string) {
    // 1) Kiểm tra quyền, ví dụ cho phép admin/manager/officer
 
    const isAdmin = await this.checkAdmin(createdBy, false);
    if (!isAdmin) {
      const user = await prisma.user.findUnique({
        where: { id: createdBy },
        include: { roles: { include: { role: true } } },
      });
      if (!user) throw new Error("User không tồn tại.");
  
      const userRoles = user.roles.map((r) => r.role.name.toLowerCase());
      if (
        !userRoles.includes("graduation_thesis_manager") &&
        !userRoles.includes("academic_officer")
      ) {
        throw new Error("Bạn không có quyền thực hiện random groups.");
      }
    }
  
    // 2) Lấy danh sách sinh viên đủ điều kiện (qualified), chưa có nhóm
    const students = await prisma.student.findMany({
      where: {
        semesterStudents: {
          some: { semesterId, qualificationStatus: "qualified" },
        },
        groupMembers: { none: {} }, // chưa trong nhóm
      },
      include: {
        user: {
          select: {
            programming_language: true, // FE, BE, Full-stack
          },
        },
        major: true, // major?.name => "Software Engineering" / "Artificial Intelligence"
      },
    });
  
    if (students.length === 0) {
      return { message: "Không có sinh viên nào đủ điều kiện để tạo nhóm." };
    }
  
    // 3) Gom theo ngành (profession/majorName)
    //    Ở đây  student.major?.name.có student.profession thì thay bằng field đó.
    const groupedByProfession: { [profName: string]: typeof students } = {};
    for (const st of students) {
      const profName = st.major?.name || "Unknown";
      if (!groupedByProfession[profName]) {
        groupedByProfession[profName] = [];
      }
      groupedByProfession[profName].push(st);
    }
  
    // Tạo list nhóm kết quả + biến đếm
    const createdGroups: any[] = [];
    let groupCounter = 1;
  
    // Hàm sinh groupCode: "G" + 2 số cuối năm + 2 ký tự ngành + index
    const generateGroupCode = (professionName: string) => {
      const yearSuffix = new Date().getFullYear().toString().slice(-2);
      // Tạo majorCode, ví dụ "SE" cho "Software Engineering", "AI" cho "Artificial Intelligence"
      let majorCode = professionName.slice(0, 2).toUpperCase(); 
      if (professionName === "Software Engineering") {
        majorCode = "SE";
      } else if (professionName === "Artificial Intelligence") {
        majorCode = "AI";
      }
      // Số thứ tự nhóm
      const sequence = String(groupCounter).padStart(2, "0");
      return `G${yearSuffix}${majorCode}${sequence}`; 
    };
  
    // Lấy 1 item cuối mảng (hoặc random)
    const popOne = (arr: any[]) => {
      if (arr.length === 0) return null;
      return arr.pop();
    };
  
    const groupSize = 5;       // tối đa
    const minGroupSize = 4;    // tối thiểu
  
    for (const professionName in groupedByProfession) {
      // Lấy danh sách SV của ngành
      const studentsInThisProf = groupedByProfession[professionName];
  
      // Tách 3 mảng FE/BE/FULL
      let feStudents = studentsInThisProf.filter(
        (s) => s.user?.programming_language === "Front-end"
      );
      let beStudents = studentsInThisProf.filter(
        (s) => s.user?.programming_language === "Back-end"
      );
      let fsStudents = studentsInThisProf.filter(
        (s) => s.user?.programming_language === "Full-stack"
      );
  
      // Tạo nhóm cho đến khi 3 bucket đều cạn
      while (feStudents.length > 0 || beStudents.length > 0 || fsStudents.length > 0) {
        // 1) Lấy 1 FE, 1 BE
        let groupMembers: typeof studentsInThisProf = [];
  
        const pickBE = popOne(beStudents);
        if (pickBE) groupMembers.push(pickBE);
  
        const pickFE = popOne(feStudents);
        if (pickFE) groupMembers.push(pickFE);
  
        // 2) Thêm 1 FS (nếu có)
        const pickFS = popOne(fsStudents);
        if (pickFS) groupMembers.push(pickFS);
  
        // 3) Thêm đến đủ 5 (nếu còn)
        while (groupMembers.length < groupSize) {
          // Xác định bucket còn ai
          if (
            feStudents.length === 0 &&
            beStudents.length === 0 &&
            fsStudents.length === 0
          ) {
            break;
          }
          let bucketsLeft = [];
          if (feStudents.length > 0) bucketsLeft.push("FE");
          if (beStudents.length > 0) bucketsLeft.push("BE");
          if (fsStudents.length > 0) bucketsLeft.push("FS");
          if (bucketsLeft.length === 0) break;
  
          // random 1 bucket
          const chosen = bucketsLeft[Math.floor(Math.random() * bucketsLeft.length)];
          let candidate;
          if (chosen === "FE") candidate = popOne(feStudents);
          else if (chosen === "BE") candidate = popOne(beStudents);
          else candidate = popOne(fsStudents);
  
          if (!candidate) break;
          groupMembers.push(candidate);
        }
  
        // Nếu nhóm < 4 => bỏ qua, không tạo
        if (groupMembers.length < minGroupSize) {
          // Optionally, có thể "trả lại" groupMembers cho bucket, 
          // nhưng demo này ta dừng luôn
          break;
        }
  
        // 4) Random chọn leader:
        //    Lấy ngẫu nhiên 1 index, hoán đổi lên đầu mảng
        const leaderIndex = Math.floor(Math.random() * groupMembers.length);
        const leader = groupMembers[leaderIndex];
        // Đưa leader lên đầu
        groupMembers[leaderIndex] = groupMembers[0];
        groupMembers[0] = leader;
  
        // 5) Tạo groupCode + cập nhật DB
        const groupCode = generateGroupCode(professionName);
        groupCounter++;
  
        const newGroup = await prisma.group.create({
          data: {
            groupCode,
            semesterId,
            status: "ACTIVE",
            createdBy,
            maxMembers: groupSize,
            isAutoCreated: true,
            members: {
              create: groupMembers.map((member, idx) => ({
                studentId: member.id,
                role: idx === 0 ? "leader" : "member", // SV đầu mảng -> leader
                status: "ACTIVE",
              })),
            },
          },
          include: { members: true },
        });
  
        createdGroups.push(newGroup);
      }
    }
  
    return {
      message: "Random nhóm thành công!",
      totalGroups: createdGroups.length,
      data: createdGroups,
    };
  }
  


  // 7) Đổi leader
  async changeLeader(groupId: string, newLeaderId: string, userId: string) {
    // Kiểm tra quyền
    const hasPermission = await this.checkLeaderOrMentor(userId, groupId);
    if (!hasPermission) {
      throw new Error("Bạn không có quyền thực hiện thao tác này.");
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) throw new Error("Nhóm không tồn tại.");

    const newLeader = group.members.find((m) => m.userId === newLeaderId);
    if (!newLeader) throw new Error("Người dùng này không thuộc nhóm.");

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

  // 8) Thêm mentor vào nhóm
  async addMentorToGroup(groupId: string, mentorId: string, userId: string) {
    // Chỉ admin
    await this.checkAdmin(userId);

    const mentor = await prisma.user.findUnique({
      where: { id: mentorId },
      include: { roles: { include: { role: true } } },
    });
    if (!mentor) throw new Error("Mentor không tồn tại.");

    const isMentor = mentor.roles.some((r) => r.role.name === "mentor");
    if (!isMentor) throw new Error("Người dùng này không phải Mentor.");

    const isAlreadyMentor = await prisma.groupMember.findFirst({
      where: { groupId, userId: mentorId },
    });
    if (isAlreadyMentor) throw new Error("Mentor đã có trong nhóm.");

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { mentor1Id: true, mentor2Id: true },
    });
    if (!group) throw new Error("Nhóm không tồn tại.");

    let updateData = {};
    if (!group.mentor1Id) {
      updateData = { mentor1Id: mentorId };
    } else if (!group.mentor2Id) {
      updateData = { mentor2Id: mentorId };
    } else {
      throw new Error("Nhóm đã có đủ 2 mentor, không thể thêm.");
    }

    await prisma.group.update({
      where: { id: groupId },
      data: updateData,
    });

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

  // 9) Xóa thành viên khỏi nhóm
  async removeMemberFromGroup(groupId: string, memberId: string, userId: string) {
    await this.checkLeaderOrMentor(userId, groupId);

    const member = await prisma.groupMember.findFirst({
      where: { groupId, OR: [{ studentId: memberId }, { userId: memberId }] },
    });
    if (!member) throw new Error("Thành viên không tồn tại trong nhóm.");

    if (member.role === "leader") {
      throw new Error("Leader không thể tự xoá chính mình khỏi nhóm.");
    }

    if (member.role === "mentor") {
      const isAdmin = await this.checkAdmin(userId, false);
      if (!isAdmin) throw new Error("Chỉ admin mới có quyền xoá mentor.");
    }

    await prisma.groupMember.delete({ where: { id: member.id } });
    return { message: "Xoá thành viên khỏi nhóm thành công." };
  }

  // 10) Xóa nhóm
  async deleteGroup(groupId: string, userId: string) {
    await this.checkLeaderOrMentor(userId, groupId);

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true, invitations: true },
    });
    if (!group) throw new Error("Nhóm không tồn tại.");

    const isAdmin = await this.checkAdmin(userId, false);
    if (!isAdmin && group.members.length > 0) {
      throw new Error("Nhóm vẫn còn thành viên, chỉ admin mới có thể xoá.");
    }

    // Xóa lời mời, thành viên, cập nhật null mentor
    await prisma.groupInvitation.deleteMany({ where: { groupId } });
    await prisma.groupMember.deleteMany({ where: { groupId } });
    await prisma.group.update({
      where: { id: groupId },
      data: {
        mentor1Id: null,
        mentor2Id: null,
      },
    });
    await prisma.group.delete({ where: { id: groupId } });

    return { message: "Nhóm đã được xoá thành công." };
  }


  // checkAdmin
  async checkAdmin(userId: string, throwError = true) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { select: { role: true } } },
    });
    const isAdmin = user?.roles.some((r) => r.role.name === "admin");
    if (!isAdmin && throwError) {
      throw new Error("Bạn không có quyền admin.");
    }
    return isAdmin;
  }

  // checkLeaderOrMentor
  async checkLeaderOrMentor(userId: string, groupId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new Error("Người dùng không tồn tại.");

    const userRoles = user.roles.map((r) => r.role.name.toLowerCase());

    // admin => qua
    if (userRoles.includes("admin")) return true;

    // còn lại => phải là leader hoặc mentor trong group
    const membership = await prisma.groupMember.findFirst({
      where: { groupId, userId, role: { in: ["leader", "mentor"] } },
    });
    if (!membership) {
      throw new Error("Bạn không có quyền thực hiện thao tác này.");
    }

    return true;
  }
}
