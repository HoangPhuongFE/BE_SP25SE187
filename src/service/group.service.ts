import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../utils/email";
import { MESSAGES } from "../constants/message";

const prisma = new PrismaClient();

export class GroupService {
  // 1) Tạo nhóm
  async createGroup(leaderId: string, semesterId: string) {
    const leader = await prisma.student.findUnique({
      where: { userId: leaderId }, // leaderId = userId, tìm ra student
      include: { major: true },
    });
    if (!leader) throw new Error("Không tìm thấy sinh viên.");

    
    const currentYear = new Date().getFullYear();
    const lastTwoDigits = currentYear.toString().slice(-2);
    const majorName = (leader.major?.name || "").trim();
    const majorCode = majorName.split(" ").map(word => word[0]).join("").toUpperCase();

    const groupCodePrefix = `G${lastTwoDigits}${majorCode}`;
    const count = await prisma.group.count({
      where: {
        semesterId,
        groupCode: { startsWith: groupCodePrefix },
      },
    });
    const sequenceNumber = (count + 1).toString().padStart(3, "0");
    const groupCode = groupCodePrefix + sequenceNumber;

    // Tạo group + leader
    const newGroup = await prisma.group.create({
      data: {
        groupCode,
        semesterId,
        status: "ACTIVE",
        createdBy: leaderId,
        maxMembers: 5,
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

  // 2) Mời thành viên (sinh viên)
  async inviteMember(groupId: string, studentId: string, invitedById: string) {
    // Kiểm tra leader/mentor/admin
    await this.checkLeaderOrMentor(invitedById, groupId);

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: { student: { include: { major: true } } },
        },
      },
    });
    if (!group) throw new Error(MESSAGES.GROUP.GROUP_NOT_FOUND);

    if (group.members.length >= 5) {
      throw new Error(MESSAGES.GROUP.GROUP_FULL);
    }
    if (group.members.some((m) => m.studentId === studentId)) {
      throw new Error(MESSAGES.GROUP.MEMBER_ALREADY_EXISTS);
    }

    // Lấy student (để kiểm tra major + qualified + email)
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true, major: true },
    });
    if (!student) throw new Error("Không tìm thấy sinh viên.");

    // Kiểm tra qualified
    const studentSemester = await prisma.semesterStudent.findFirst({
      where: { studentId, semesterId: group.semesterId },
    });
    if (!studentSemester || studentSemester.qualificationStatus.trim().toLowerCase() !== "qualified") {

      throw new Error("Sinh viên không đủ điều kiện tham gia nhóm.");
    }

    // Kiểm tra cùng ngành?
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
    if (existingInvitation) {
      throw new Error(MESSAGES.GROUP.INVITATION_EXISTS);
    }

    // Tạo lời mời
    const invitation = await prisma.groupInvitation.create({
      data: { groupId, studentId, status: "PENDING" },
    });

    // Gửi email
    if (student.user?.email) {
      const invitationLink = `http://160.187.241.152:6969/api/groups/accept-invitation/${invitation.id}`;
      const emailContent = `
        <p>Xin chào ${student.user.fullName || student.user.username},</p>
        <p>Bạn đã được mời tham gia nhóm ${group.groupCode}. Click vào link để chấp nhận lời mời:</p>
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

  // 3) respondToInvitation
  async respondToInvitation(
    invitationId: string,
    userId: string,
    response: "ACCEPTED" | "REJECTED"
  ) {
    // Lấy studentId từ user
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

    return {
      message: MESSAGES.GROUP.INVITATION_REJECTED,
      data: updatedInvitation,
    };
  }

  // 4) getGroupInfo
  async getGroupInfo(groupId: string) {
    return prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            student: { include: { user: true } },
          },
        },
      },
    });
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
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });

    // Thêm vào group
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

  // 5) getGroupsBySemester
  async getGroupsBySemester(semesterId: string, userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new Error("Người dùng không tồn tại.");

    const userRoles = user.roles.map((r) => r.role.name.toLowerCase());

    if (userRoles.includes("graduation_thesis_manager") || userRoles.includes("admin")) {
      return prisma.group.findMany({
        where: { semesterId },
        include: {
          members: {
            include: { student: { include: { user: true } } },
          },
        },
      });
    }

    // Student => chỉ xem nhóm của họ
    if (userRoles.includes("student")) {
      const student = await prisma.student.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!student) throw new Error("Không tìm thấy sinh viên.");

      return prisma.group.findMany({
        where: {
          semesterId,
          members: { some: { studentId: student.id } },
        },
        include: {
          members: { include: { student: { include: { user: true } } } },
        },
      });
    }

    // Lecturer/Mentor => xem nhóm do họ hướng dẫn
    if (userRoles.includes("lecturer") || userRoles.includes("mentor")) {
      return prisma.group.findMany({
        where: {
          semesterId,
          OR: [{ mentor1Id: userId }, { mentor2Id: userId }],
        },
        include: {
          members: { include: { student: { include: { user: true } } } },
        },
      });
    }

    throw new Error("Bạn không có quyền truy cập danh sách nhóm.");
  }

  // 6) getStudentsWithoutGroup
  async getStudentsWithoutGroup(semesterId: string) {
    return prisma.student.findMany({
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
  }

  // 7) randomizeGroups
  async randomizeGroups(semesterId: string, createdBy: string) {
    // Kiểm tra admin/manager/officer
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

    // Lấy sinh viên qualified, chưa nhóm
    const students = await prisma.student.findMany({
      where: {
        semesterStudents: {
          some: { semesterId, qualificationStatus: "qualified" },
        },
        groupMembers: { none: {} },
      },
      include: {
        user: { select: { programming_language: true } },
        major: true,
      },
    });
    if (students.length === 0) {
      return { message: "Không có sinh viên nào đủ điều kiện để tạo nhóm." };
    }

    // Gom theo ngành
    const groupedByProfession: { [profName: string]: typeof students } = {};
    for (const st of students) {
      const profName = st.major?.name || "Unknown";
      if (!groupedByProfession[profName]) {
        groupedByProfession[profName] = [];
      }
      groupedByProfession[profName].push(st);
    }

    const createdGroups = [];
    let groupCounter = 1;

    const generateGroupCode = (professionName: string) => {
      const yearSuffix = new Date().getFullYear().toString().slice(-2);
      let majorCode = professionName.slice(0, 2).toUpperCase();
      if (professionName === "Software Engineering") majorCode = "SE";
      else if (professionName === "Artificial Intelligence") majorCode = "AI";

      const seq = String(groupCounter).padStart(2, "0");
      return `G${yearSuffix}${majorCode}${seq}`;
    };

    const popOne = (arr: any[]) => (arr.length === 0 ? null : arr.pop());

    const groupSize = 5,
      minGroupSize = 4;

    for (const professionName in groupedByProfession) {
      const studentsInThisProf = groupedByProfession[professionName];

      let feStudents = studentsInThisProf.filter(
        (s) => s.user?.programming_language === "Front-end"
      );
      let beStudents = studentsInThisProf.filter(
        (s) => s.user?.programming_language === "Back-end"
      );
      let fsStudents = studentsInThisProf.filter(
        (s) => s.user?.programming_language === "Full-stack"
      );

      while (feStudents.length > 0 || beStudents.length > 0 || fsStudents.length > 0) {
        const groupMembers: typeof studentsInThisProf = [];
        // Lấy 1 BE, 1 FE
        const pickBE = popOne(beStudents);
        if (pickBE) groupMembers.push(pickBE);
        const pickFE = popOne(feStudents);
        if (pickFE) groupMembers.push(pickFE);

        // + 1 FS nếu còn
        const pickFS = popOne(fsStudents);
        if (pickFS) groupMembers.push(pickFS);

        // Thêm tới 5
        while (groupMembers.length < groupSize) {
          if (
            feStudents.length === 0 &&
            beStudents.length === 0 &&
            fsStudents.length === 0
          ) {
            break;
          }
          const bucketsLeft = [];
          if (feStudents.length > 0) bucketsLeft.push("FE");
          if (beStudents.length > 0) bucketsLeft.push("BE");
          if (fsStudents.length > 0) bucketsLeft.push("FS");
          if (bucketsLeft.length === 0) break;

          const chosen = bucketsLeft[Math.floor(Math.random() * bucketsLeft.length)];
          let candidate;
          if (chosen === "FE") candidate = popOne(feStudents);
          else if (chosen === "BE") candidate = popOne(beStudents);
          else candidate = popOne(fsStudents);

          if (!candidate) break;
          groupMembers.push(candidate);
        }

        // Nếu nhóm < 4 => bỏ
        if (groupMembers.length < minGroupSize) break;

        // random leader
        const leaderIndex = Math.floor(Math.random() * groupMembers.length);
        const leader = groupMembers[leaderIndex];
        groupMembers[leaderIndex] = groupMembers[0];
        groupMembers[0] = leader;

        // Tạo group
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
                role: idx === 0 ? "leader" : "member",
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

  // 8) changeLeader
  async changeLeader(groupId: string, newLeaderId: string, userId: string) {
    await this.checkLeaderOrMentor(userId, groupId);

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) throw new Error("Nhóm không tồn tại.");

    // Tìm theo studentId
    const newLeader = group.members.find((m) => m.studentId === newLeaderId);
    if (!newLeader) {
      throw new Error("Người dùng này (studentId) không thuộc nhóm.");
    }

    // Đổi tất cả về member
    await prisma.groupMember.updateMany({
      where: { groupId },
      data: { role: "member" },
    });

    // Update leader
    await prisma.groupMember.update({
      where: { id: newLeader.id },
      data: { role: "leader" },
    });

    return { message: "Leader đã được thay đổi thành công." };
  }

  // 9) addMentorToGroup
  async addMentorToGroup(groupId: string, mentorId: string, userId: string) {
    await this.checkAdminOrManagerOrOfficer(userId);
  
    // 1) Lấy thông tin mentor
    const mentor = await prisma.user.findUnique({
      where: { id: mentorId },
      include: { roles: { include: { role: true } } },
    });
    if (!mentor) throw new Error("Mentor không tồn tại.");
  
    const isMentor = mentor.roles.some(r => r.role.name === "mentor");
    if (!isMentor) throw new Error("Người dùng này không phải Mentor.");
  
    // 2) Kiểm tra mentor đã có trong nhóm chưa
    const isAlreadyMentor = await prisma.groupMember.findFirst({
      where: { groupId, userId: mentorId },
    });
    if (isAlreadyMentor) throw new Error("Mentor đã có trong nhóm.");
  
    // 3) Kiểm tra nhóm có tồn tại
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { mentor1Id: true, mentor2Id: true },
    });
    if (!group) throw new Error("Nhóm không tồn tại.");
  
    // 4) Set mentor1/mentor2 (nếu còn trống)
    let updateData = {};
    if (!group.mentor1Id) {
      updateData = { mentor1Id: mentorId };
    } else if (!group.mentor2Id) {
      updateData = { mentor2Id: mentorId };
    } else {
      throw new Error("Nhóm đã có đủ 2 mentor, không thể thêm.");
    }
  
    // 5) Update bảng group
    await prisma.group.update({
      where: { id: groupId },
      data: updateData,
    });
  
    // 6) Thêm vào groupMember (cột userId = mentorId)
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
  

  // 10) removeMemberFromGroup
  async removeMemberFromGroup(groupId: string, memberId: string, userId: string) {
    await this.checkLeaderOrMentor(userId, groupId);

    // Tìm theo studentId or userId
    const member = await prisma.groupMember.findFirst({
      where: {
        groupId,
        OR: [{ studentId: memberId }, { userId: memberId }],
      },
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

  // 11) deleteGroup
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

    // xóa hết invitation, member, mentor => group
    await prisma.groupInvitation.deleteMany({ where: { groupId } });
    await prisma.groupMember.deleteMany({ where: { groupId } });
    await prisma.group.update({
      where: { id: groupId },
      data: { mentor1Id: null, mentor2Id: null },
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
    // 1) Lấy user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new Error("Người dùng không tồn tại.");

    // 2) Nếu user là admin => pass
    const userRoles = user.roles.map((r) => r.role.name.toLowerCase());
    if (userRoles.includes("admin")) return true;

    // 3) Kiểm tra membership => leader/mentor
    //    - Nếu user là sinh viên => có studentId => groupMember(studentId=.., role in [...])
    //    - Nếu user là mentor => cột userId => groupMember(userId=.., role="mentor")
    // Mặc định, mentor ko làm leader => tách OR 
    
    const student = await prisma.student.findUnique({ where: { userId: user.id } });

    // TH1: user là sinh viên
    if (student) {
      const membership = await prisma.groupMember.findFirst({
        where: {
          groupId,
          studentId: student.id,
          role: { in: ["leader", "mentor"] }, // "mentor" nếu code cho phép SV-mentor
        },
      });
      if (membership) return true;
    }

    // TH2: user có role "mentor" => check groupMember(userId=..., role="mentor")
    //      => áp dụng cho giảng viên mentor
    const membershipMentor = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        role: "mentor",
      },
    });
    if (membershipMentor) return true;

    throw new Error("Bạn không có quyền (không phải leader/mentor).");
  }

// checkAdminOrManagerOrOfficer
async checkAdminOrManagerOrOfficer(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });
  if (!user) throw new Error("Người dùng không tồn tại.");

  const userRoles = user.roles.map(r => r.role.name.toLowerCase());

  // Nếu user có role "admin" hoặc "graduation_thesis_manager" hoặc "academic_officer", pass
  if (
    userRoles.includes("admin") ||
    userRoles.includes("graduation_thesis_manager") ||
    userRoles.includes("academic_officer")
  ) {
    return true;
  }

  // Nếu không, báo lỗi
  throw new Error("Bạn không có quyền thêm mentor vào nhóm.");
}

// 12) leaveGroup
async leaveGroup(groupId: string, userId: string) {
  // 1) Tìm user + roles
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  // 2) Tìm membership trong nhóm
  //    - Nếu user là sinh viên => check studentId
  //    - Nếu user là mentor => check userId
  // Ta có thể làm chung:
  const student = await prisma.student.findUnique({ where: { userId } });
  let member;
  if (student) {
    // user là sinh viên
    member = await prisma.groupMember.findFirst({
      where: { groupId, studentId: student.id },
    });
  } else {
    // user là mentor
    member = await prisma.groupMember.findFirst({
      where: { groupId, userId },
    });
  }

  if (!member) throw new Error("Bạn không thuộc nhóm này.");

  // 3) Không cho leader tự rời
  if (member.role === "leader") {
    throw new Error("Leader không thể tự rời nhóm. Hãy đổi leader trước.");
  }

  // 4) Xoá record groupMember
  await prisma.groupMember.delete({ where: { id: member.id } });

  return { message: "Rời nhóm thành công." };
}


// 13) cancelInvitation
async cancelInvitation(invitationId: string, userId: string) {
  // 1) Lấy invitation
  const invitation = await prisma.groupInvitation.findUnique({
    where: { id: invitationId },
  });
  if (!invitation) throw new Error("Invitation không tồn tại.");
  if (invitation.status !== "PENDING") {
    throw new Error("Lời mời không còn ở trạng thái PENDING, không thể hủy.");
  }

  // 2) Kiểm tra quyền: leader/mentor/admin của invitation.groupId
  await this.checkLeaderOrMentor(userId, invitation.groupId);

  // 3) Hủy (update status)
  await prisma.groupInvitation.update({
    where: { id: invitationId },
    data: { status: "CANCELLED" },
  });

  return { message: "Đã hủy lời mời thành công." };
}

// 14) listGroupInvitations
async listGroupInvitations(groupId: string, userId: string) {
  // 1) Kiểm tra leader/mentor/admin
  await this.checkLeaderOrMentor(userId, groupId);

  // 2) Tìm toàn bộ invitation
  const invitations = await prisma.groupInvitation.findMany({
    where: { groupId },
  });
  return invitations;
}


// 15) lockGroup
async lockGroup(groupId: string, userId: string) {
  // 1) Kiểm tra quyền: user phải là leader, mentor hoặc admin của nhóm
  await this.checkLeaderOrMentor(userId, groupId);

  // 2) Tìm group
  const group = await prisma.group.findUnique({
    where: { id: groupId },
  });
  if (!group) throw new Error("Nhóm không tồn tại.");

  // 3) Nếu đã khóa => báo lỗi (hoặc bỏ qua tuỳ bạn)
  // if (group.isLocked) {
  //   throw new Error("Nhóm đã khóa rồi.");
  // }

  // 4) Cập nhật cột isLocked = true
  await prisma.group.update({
    where: { id: groupId },
    data: { isLocked: true },
  });

  return { message: "Nhóm đã được khóa thành công." };
}



// 16) updateGroup
async updateGroup(groupId: string, userId: string, data: { maxMembers?: number; status?: string; topicEnglish?: string; topicTiengViet?: string; }) {
  // 1) Kiểm tra quyền: leader/mentor/admin
  //    Tùy yêu cầu, có thể chỉ admin
  await this.checkLeaderOrMentor(userId, groupId);

  // 2) Xem group
  const group = await prisma.group.findUnique({ where: { id: groupId }, include: { members: true } });
  if (!group) throw new Error("Nhóm không tồn tại.");

  // 3) Kiểm tra logic, ví dụ maxMembers >= group.members.length
  if (data.maxMembers && data.maxMembers < group.members.length) {
    throw new Error("maxMembers không được nhỏ hơn số thành viên hiện tại.");
  }

  // 4) Update
  const updated = await prisma.group.update({
    where: { id: groupId },
    data,
  });
  return { message: "Cập nhật thông tin nhóm thành công.", data: updated };
}



// 17) updateMentor
async updateMentor(
  groupId: string,
  oldMentorId: string,
  newMentorId: string,
  userId: string
) {
  // 1) Kiểm tra quyền => admin / manager / officer
  await this.checkAdminOrManagerOrOfficer(userId);

  // 2) Tìm group
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { mentor1Id: true, mentor2Id: true },
  });
  if (!group) throw new Error("Nhóm không tồn tại.");

  // 3) mentor cũ thuộc mentor1Id hay mentor2Id?
  let mentorSlot: "mentor1Id" | "mentor2Id" | null = null;
  if (group.mentor1Id === oldMentorId) {
    mentorSlot = "mentor1Id";
  } else if (group.mentor2Id === oldMentorId) {
    mentorSlot = "mentor2Id";
  }
  if (!mentorSlot) throw new Error("Mentor cũ không phải mentor1 hoặc mentor2.");

  // 4) Update mentor cũ => null, mentorSlot => newMentorId
  //   Hoặc tùy logic: group.mentor1Id => newMentorId
  const updateData: any = {};
  updateData[mentorSlot] = newMentorId; // cột cũ = newMentor

  await prisma.group.update({
    where: { id: groupId },
    data: updateData,
  });

  // 5) Xoá record groupMember cũ (role=mentor, userId= oldMentorId)
  await prisma.groupMember.deleteMany({
    where: { groupId, userId: oldMentorId, role: "mentor" },
  });

  // 6) Tạo record groupMember mới (role=mentor, userId= newMentorId)
  //    hoặc nếu đã có -> update role=mentor
  const existing = await prisma.groupMember.findFirst({
    where: { groupId, userId: newMentorId },
  });
  if (!existing) {
    await prisma.groupMember.create({
      data: {
        groupId,
        userId: newMentorId,
        role: "mentor",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });
  } else {
    await prisma.groupMember.update({
      where: { id: existing.id },
      data: { role: "mentor" },
    });
  }

  return { message: "Đã thay đổi mentor thành công." };
}


async getGroupMembers(groupId: string, userId: string) {
  // Kiểm tra quyền: leader/mentor/admin => xem
  await this.checkLeaderOrMentor(userId, groupId);

  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: {
      student: { include: { user: true } },
    },
  });
  return members;
}




}
