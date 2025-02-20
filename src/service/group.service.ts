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
 
  async inviteMember(groupId: string, studentEmail: string, invitedById: string) {
    console.log(`DEBUG: Start inviteMember - invitedById=${invitedById}, groupId=${groupId}, studentEmail=${studentEmail}`);

    //  1️ Tìm sinh viên theo email
    const invitedStudent = await prisma.student.findFirst({
      where: { user: { email: studentEmail } }, // Tìm user có email tương ứng
      include: { user: true, major: true },
    });

    if (!invitedStudent) throw new Error(`Không tìm thấy sinh viên với email: ${studentEmail}`);

    //  2️ Lấy thông tin người mời (User)
    const inviter = await prisma.user.findUnique({
      where: { id: invitedById },
      include: { roles: { include: { role: true } } },
    });

    if (!inviter) throw new Error(`Người mời không tồn tại với ID=${invitedById}`);

    //  3️ Lấy `studentId` của người mời
    const inviterStudent = await prisma.student.findFirst({
        where: { userId: invitedById },
        select: { id: true }, // Chỉ lấy id
    });

    //  4️ Kiểm tra quyền của người mời
    const userRoles = inviter.roles.map((r) => r.role.name.toLowerCase());
    console.log(`DEBUG: User roles = [${userRoles.join(", ")}]`);

    if (!userRoles.includes("admin")) {
      // Kiểm tra nếu user là leader hoặc mentor
      const isLeader = await prisma.groupMember.findFirst({
        where: { groupId, studentId: inviterStudent?.id, role: "leader", isActive: true },
      });

      const isMentor = await prisma.groupMember.findFirst({
        where: { groupId, userId: invitedById, role: "mentor", isActive: true },
      });

      console.log(`DEBUG: Leader=${!!isLeader}, Mentor=${!!isMentor}`);

      if (!isLeader && !isMentor) {
        throw new Error("Bạn không có quyền mời thành viên vào nhóm.");
      }
    }

    //  5️ Kiểm tra nhóm có tồn tại không
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: { include: { student: { include: { major: true } } } } },
    });

    if (!group) throw new Error("Nhóm không tồn tại.");

    console.log(`DEBUG: Group found with groupCode=${group.groupCode}, memberCount=${group.members.length}`);

    //  6️ Kiểm tra nhóm có đầy chưa
    if (group.members.length >= 5) {
      throw new Error("Nhóm đã đủ thành viên.");
    }

    //  7️Kiểm tra sinh viên đã trong nhóm chưa
    if (group.members.some((m) => m.studentId === invitedStudent.id)) {
      throw new Error("Sinh viên đã có trong nhóm.");
    }

    //  8️ Kiểm tra điều kiện tham gia nhóm
    const studentSemester = await prisma.semesterStudent.findFirst({
      where: { studentId: invitedStudent.id, semesterId: group.semesterId },
    });

    if (!studentSemester || studentSemester.qualificationStatus.trim().toLowerCase() !== "qualified") {
      throw new Error("Sinh viên không đủ điều kiện tham gia nhóm.");
    }

    //  9️ Kiểm tra ngành học có khớp nhóm không
    if (group.members.length > 0) {
      const groupMajor = group.members[0]?.student?.major?.id;
      if (invitedStudent.major?.id && groupMajor && invitedStudent.major.id !== groupMajor) {
        throw new Error(`Sinh viên thuộc ngành khác (${invitedStudent.major?.name}), không thể tham gia nhóm.`);
      }
    }

    // 1010  Kiểm tra lời mời trước đó
    const existingInvitation = await prisma.groupInvitation.findFirst({
      where: { groupId, studentId: invitedStudent.id, status: "PENDING" },
    });

    if (existingInvitation) {
      throw new Error("Sinh viên đã có lời mời đang chờ.");
    }

    //  1️1️ Tạo lời mời
    const invitation = await prisma.groupInvitation.create({
      data: { groupId, studentId: invitedStudent.id, status: "PENDING" },
    });

    console.log(`DEBUG: Lời mời đã được tạo với ID=${invitation.id}`);

    // 1️2️ Gửi email
    if (invitedStudent.user?.email) {
      const invitationLink = `http://160.187.241.152:6969/api/groups/accept-invitation/${invitation.id}`;
      const emailContent = `
          <p>Xin chào ${invitedStudent.user.fullName || invitedStudent.user.username},</p>
          <p>Bạn đã được mời tham gia nhóm <b>${group.groupCode}</b>. Click vào link để chấp nhận lời mời:</p>
          <a href="${invitationLink}">Chấp nhận lời mời</a>
      `;

      try {
        await sendEmail({
          to: invitedStudent.user.email,
          subject: "Lời mời tham gia nhóm",
          html: emailContent,
        });

        await prisma.emailLog.create({
          data: {
            userId: invitedById,
            recipientEmail: invitedStudent.user.email,
            subject: "Lời mời tham gia nhóm",
            content: emailContent,
            status: "SENT",
            errorAt: new Date(),
          },
        });

        console.log(`DEBUG: Email mời đã được gửi tới ${invitedStudent.user.email}`);
      } catch (error) {
        await prisma.emailLog.create({
          data: {
            userId: invitedById,
            recipientEmail: invitedStudent.user.email,
            subject: "Lời mời tham gia nhóm",
            content: emailContent,
            status: "FAILED",
            errorMessage: (error as Error).message,
            errorAt: new Date(),
          },
        });

        console.error(`Lỗi gửi email cho ${invitedStudent.user.email}:`, error);
      }
    }

    return { message: "Lời mời đã được gửi thành công.", data: invitation };
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
   // console.log(`DEBUG: Start randomizeGroups - semesterId=${semesterId}, createdBy=${createdBy}`);
  
    // 1️ Kiểm tra quyền
    const user = await prisma.user.findUnique({
      where: { id: createdBy },
      include: { roles: { include: { role: true } } },
    });
  
    if (!user) {
      console.error(`ERROR: Không tìm thấy user - createdBy=${createdBy}`);
      throw new Error("Người dùng không tồn tại.");
    }
  
    const userRoles = user.roles.map((r) => r.role.name.toLowerCase());
    const isAuthorized = userRoles.includes("admin") || 
                         userRoles.includes("graduation_thesis_manager") || 
                         userRoles.includes("academic_officer");
  
    if (!isAuthorized) {
      console.error(` Người dùng không có quyền random nhóm - createdBy=${createdBy}`);
      throw new Error("Bạn không có quyền thực hiện random nhóm.");
    }
  
    // 2️ Lấy sinh viên đủ điều kiện nhưng chưa có nhóm
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
      //console.log("INFO: Không có sinh viên nào đủ điều kiện để tạo nhóm.");
      return { message: "Không có sinh viên nào đủ điều kiện để tạo nhóm." };
    }
  
    // 3️ Gom theo ngành
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
  
        // Thêm tới 5 thành viên
        while (groupMembers.length < groupSize) {
          if (feStudents.length === 0 && beStudents.length === 0 && fsStudents.length === 0) {
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
  
        // Random leader
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
  
       // console.log(`INFO: Nhóm mới được tạo - groupCode=${groupCode}, memberCount=${groupMembers.length}`);
        createdGroups.push(newGroup);
      }
    }
  
   // console.log(`SUCCESS: Random nhóm thành công - totalGroups=${createdGroups.length}`);
    return {
      message: "Random nhóm thành công!",
      totalGroups: createdGroups.length,
      data: createdGroups,
    };
  }
  

  // 8) changeLeader
  async changeLeader(groupId: string, newLeaderId: string, userId: string) {
    // 1️ Lấy thông tin user (để kiểm tra quyền)
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } },
    });
    if (!user) throw new Error("Người dùng không tồn tại.");

    const userRoles = user.roles.map((r) => r.role.name.toLowerCase());

    // 2️ Nếu là admin => Cho phép đổi leader
    if (!userRoles.includes("admin")) {
        // Nếu không phải admin, kiểm tra xem user có phải leader hoặc mentor trong nhóm không
        const student = await prisma.student.findUnique({ where: { userId } });
        if (!student) throw new Error("Bạn không phải sinh viên, không có quyền đổi leader.");

        //  Kiểm tra quyền leader
        const isLeader = await prisma.groupMember.findFirst({
            where: { groupId, studentId: student.id, role: "leader", isActive: true },
        });

        //  Kiểm tra quyền mentor
        const isMentor = await prisma.groupMember.findFirst({
            where: { groupId, userId, role: "mentor", isActive: true },
        });

        if (!isLeader && !isMentor) {
            throw new Error("Bạn không có quyền đổi leader (chỉ leader, mentor hoặc admin mới có quyền).");
        }
    }

    // 3️ Kiểm tra nhóm có tồn tại không
    const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: { members: true },
    });
    if (!group) throw new Error("Nhóm không tồn tại.");

    // 4️Tìm thành viên mới để làm leader (phải là studentId)
    const newLeader = group.members.find((m) => m.studentId === newLeaderId);
    if (!newLeader) {
        throw new Error("Người dùng này (studentId) không thuộc nhóm.");
    }

    // 5️ Đổi tất cả thành member trước khi cập nhật leader mới
    await prisma.groupMember.updateMany({
        where: { groupId },
        data: { role: "member" },
    });

    // 6️ Cập nhật leader mới
    await prisma.groupMember.update({
        where: { id: newLeader.id },
        data: { role: "leader" },
    });

    return { message: "Leader đã được thay đổi thành công." };
}


  // 9) addMentorToGroup
  async addMentorToGroup(groupId: string, mentorId: string, invitedById: string) {
   // console.log(`DEBUG: Bắt đầu addMentorToGroup - groupId=${groupId}, mentorId=${mentorId}, invitedById=${invitedById}`);
    // 1️ Kiểm tra quyền: chỉ leader, mentor hoặc admin mới được thêm mentor
    const user = await prisma.user.findUnique({
        where: { id: invitedById },
        include: { roles: { include: { role: true } } },
    });

    if (!user) {
        console.error(`ERROR: Không tìm thấy user với ID=${invitedById}`);
        throw new Error("Người dùng không tồn tại.");
    }

    const userRoles = user.roles.map(r => r.role.name.toLowerCase());
    const isAdmin = userRoles.includes("admin");

    // Kiểm tra xem user có phải leader hoặc mentor trong nhóm không
    const student = await prisma.student.findUnique({ where: { userId: invitedById } });
    let isAuthorized = isAdmin;

    if (student) {
        const leader = await prisma.groupMember.findFirst({
            where: { groupId, studentId: student.id, role: "leader", isActive: true },
        });
        if (leader) isAuthorized = true;
    }

    const mentor = await prisma.groupMember.findFirst({
        where: { groupId, userId: invitedById, role: "mentor", isActive: true },
    });

    if (mentor) isAuthorized = true;

    if (!isAuthorized) {
        throw new Error("Bạn không có quyền thêm mentor vào nhóm (chỉ leader, mentor hoặc admin).");
    }

    // 2️ Lấy thông tin mentor
    const mentorUser = await prisma.user.findUnique({
        where: { id: mentorId },
        include: { roles: { include: { role: true } } },
    });

    if (!mentorUser) {
        console.error(`Không tìm thấy mentor với ID=${mentorId}`);
        throw new Error("Mentor không tồn tại.");
    }

    // Kiểm tra role mentor
    const isMentor = mentorUser.roles.some(r => r.role.name === "mentor");
    if (!isMentor) {
        console.error(` Người dùng không phải Mentor - mentorId=${mentorId}`);
        throw new Error("Người dùng này không phải Mentor.");
    }

    // 3️ Kiểm tra nhóm có tồn tại không
    const group = await prisma.group.findUnique({
        where: { id: groupId },
        select: { mentor1Id: true, mentor2Id: true },
    });

    if (!group) {
        console.error(`ERROR: Nhóm không tồn tại - groupId=${groupId}`);
        throw new Error("Nhóm không tồn tại.");
    }

    // 4️ Kiểm tra nếu mentor đã có trong nhóm
    if (group.mentor1Id === mentorId || group.mentor2Id === mentorId) {
        throw new Error("Mentor đã có trong nhóm.");
    }

    // 5️ Gán mentor vào slot trống
    let updateData = {};
    if (!group.mentor1Id) {
        updateData = { mentor1Id: mentorId };
    } else if (!group.mentor2Id) {
        updateData = { mentor2Id: mentorId };
    } else {
        throw new Error("Nhóm đã có đủ 2 mentor, không thể thêm.");
    }

    // 6️ Cập nhật bảng group
    await prisma.group.update({
        where: { id: groupId },
        data: updateData,
    });

    // 7️ Thêm vào bảng groupMember
    await prisma.groupMember.create({
        data: {
            groupId,
            userId: mentorId,
            role: "mentor",
            status: "ACTIVE",
            joinedAt: new Date(),
        },
    });

    //console.log(`SUCCESS: Mentor ${mentorId} đã được thêm vào nhóm ${groupId}`);
    return { message: "Mentor đã được thêm vào nhóm thành công." };
}


  // 10) removeMemberFromGroup
  async removeMemberFromGroup(groupId: string, memberId: string, invitedById: string) {
    //console.log(`DEBUG: Bắt đầu removeMemberFromGroup - groupId=${groupId}, memberId=${memberId}, invitedById=${invitedById}`);

    // 1️Kiểm tra quyền: chỉ leader, mentor hoặc admin mới có thể xóa thành viên
    const user = await prisma.user.findUnique({
        where: { id: invitedById },
        include: { roles: { include: { role: true } } },
    });

    if (!user) {
        console.error(`ERROR: Không tìm thấy user với ID=${invitedById}`);
        throw new Error("Người dùng không tồn tại.");
    }

    const userRoles = user.roles.map(r => r.role.name.toLowerCase());
    const isAdmin = userRoles.includes("admin");

    // Kiểm tra xem user có phải leader hoặc mentor trong nhóm không
    const student = await prisma.student.findUnique({ where: { userId: invitedById } });
    let isAuthorized = isAdmin;

    if (student) {
        const leader = await prisma.groupMember.findFirst({
            where: { groupId, studentId: student.id, role: "leader", isActive: true },
        });
        if (leader) isAuthorized = true;
    }

    const mentor = await prisma.groupMember.findFirst({
        where: { groupId, userId: invitedById, role: "mentor", isActive: true },
    });

    if (mentor) isAuthorized = true;

    if (!isAuthorized) {
        console.error("ERROR: Người dùng không có quyền xóa thành viên.");
        throw new Error("Bạn không có quyền xoá thành viên khỏi nhóm (chỉ leader, mentor hoặc admin).");
    }

    // 2️ Kiểm tra thành viên cần xóa có tồn tại trong nhóm không
    const member = await prisma.groupMember.findFirst({
        where: {
            groupId,
            OR: [{ studentId: memberId }, { userId: memberId }],
        },
    });

    if (!member) {
        console.error(` Thành viên không tồn tại trong nhóm - memberId=${memberId}`);
        throw new Error("Thành viên không tồn tại trong nhóm.");
    }

    // 3️ Không cho phép leader tự xóa mình, phải đổi leader trước
    if (member.role === "leader") {
        console.error(" Leader không thể tự xoá chính mình khỏi nhóm.");
        throw new Error("Leader không thể tự xoá chính mình khỏi nhóm. Hãy đổi leader trước.");
    }

    // 4️ Mentor chỉ có thể bị xóa bởi admin
    if (member.role === "mentor" && !isAdmin) {
        console.error("ERROR: Chỉ admin mới có quyền xóa mentor.");
        throw new Error("Chỉ admin mới có quyền xoá mentor.");
    }

    // 5️ Xóa thành viên khỏi nhóm
    await prisma.groupMember.delete({ where: { id: member.id } });

   // console.log(`SUCCESS: Đã xoá thành viên ${memberId} khỏi nhóm ${groupId}`);
    return { message: "Xoá thành viên khỏi nhóm thành công." };
}


  // 11) deleteGroup
  async deleteGroup(groupId: string, userId: string) {
  //  console.log(`DEBUG: Bắt đầu deleteGroup - groupId=${groupId}, userId=${userId}`);

    // 1️ Kiểm tra user có tồn tại không
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } },
    });

    if (!user) {
        console.error(`ERROR: Không tìm thấy user với ID=${userId}`);
        throw new Error("Người dùng không tồn tại.");
    }

    const userRoles = user.roles.map(r => r.role.name.toLowerCase());
    const isAdmin = userRoles.includes("admin");

    // 2️ Kiểm tra thông tin nhóm
    const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: { members: true, invitations: true },
    });

    if (!group) {
        console.error(`ERROR: Nhóm không tồn tại - groupId=${groupId}`);
        throw new Error("Nhóm không tồn tại.");
    }

    // 3️ Kiểm tra xem user có phải leader của nhóm không
    const student = await prisma.student.findUnique({ where: { userId } });
    let isLeader = false;

    if (student) {
        const leader = await prisma.groupMember.findFirst({
            where: { groupId, studentId: student.id, role: "leader", isActive: true },
        });
        if (leader) isLeader = true;
    }

    // 4️ Nếu không phải admin hoặc leader -> từ chối
    if (!isAdmin && !isLeader) {
        console.error(" Người dùng không có quyền xóa nhóm.");
        throw new Error("Bạn không có quyền xoá nhóm (chỉ leader hoặc admin).");
    }

    // 5️ Nếu nhóm còn thành viên khác, chỉ admin mới có quyền xóa
    if (!isAdmin && group.members.length > 1) {
        console.error(" Nhóm vẫn còn thành viên, chỉ admin có thể xóa.");
        throw new Error("Nhóm vẫn còn thành viên, chỉ admin mới có thể xoá.");
    }

    // 6️ Xóa hết dữ liệu liên quan trước khi xóa nhóm
    await prisma.groupInvitation.deleteMany({ where: { groupId } });
    await prisma.groupMember.deleteMany({ where: { groupId } });

    // Xóa mentor khỏi nhóm
    await prisma.group.update({
        where: { id: groupId },
        data: { mentor1Id: null, mentor2Id: null },
    });

    // 7️ Xóa nhóm
    await prisma.group.delete({ where: { id: groupId } });

   // console.log(`SUCCESS Nhóm ${groupId} đã bị xóa.`);
    return { message: "Nhóm đã được xoá thành công." };
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
    console.log(`DEBUG: Bắt đầu cancelInvitation - invitationId=${invitationId}, userId=${userId}`);

    // 1️ Kiểm tra lời mời có tồn tại không
    const invitation = await prisma.groupInvitation.findUnique({
        where: { id: invitationId },
        include: { group: true },
    });

    if (!invitation) {
        console.error(` Invitation không tồn tại - invitationId=${invitationId}`);
        throw new Error("Invitation không tồn tại.");
    }

    if (invitation.status !== "PENDING") {
        console.error(`Lời mời đã xử lý hoặc hết hạn - invitationId=${invitationId}`);
        throw new Error("Lời mời không còn ở trạng thái PENDING, không thể hủy.");
    }

    const groupId = invitation.groupId;

    // 2️ Kiểm tra thông tin user
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } },
    });

    if (!user) {
        console.error(` Không tìm thấy user - userId=${userId}`);
        throw new Error("Người dùng không tồn tại.");
    }

    const userRoles = user.roles.map(r => r.role.name.toLowerCase());
    const isAdmin = userRoles.includes("admin");

    // 3️ Kiểm tra xem user có phải leader của nhóm không
    const student = await prisma.student.findUnique({ where: { userId } });
    let isLeader = false;

    if (student) {
        const leader = await prisma.groupMember.findFirst({
            where: { groupId, studentId: student.id, role: "leader", isActive: true },
        });
        if (leader) isLeader = true;
    }

    // 4️ Nếu không phải admin hoặc leader -> từ chối
    if (!isAdmin && !isLeader) {
        console.error(` Người dùng không có quyền hủy lời mời - userId=${userId}`);
        throw new Error("Bạn không có quyền hủy lời mời (chỉ leader hoặc admin).");
    }

    // 5️ Cập nhật trạng thái lời mời thành "CANCELLED"
    await prisma.groupInvitation.update({
        where: { id: invitationId },
        data: { status: "CANCELLED" },
    });

    console.log(`SUCCESS: Lời mời ${invitationId} đã bị hủy.`);
    return { message: "Đã hủy lời mời thành công." };
}


  // 14) listGroupInvitations
  async listGroupInvitations(groupId: string, userId: string) {
   // console.log(`DEBUG: Bắt đầu listGroupInvitations - groupId=${groupId}, userId=${userId}`);

    // 1️ Kiểm tra thông tin user
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

    // 2️ Kiểm tra xem user có phải leader của nhóm không
    const student = await prisma.student.findUnique({ where: { userId } });
    let isLeader = false;

    if (student) {
        const leader = await prisma.groupMember.findFirst({
            where: { groupId, studentId: student.id, role: "leader", isActive: true },
        });
        if (leader) isLeader = true;
    }

    // 3️ Nếu không phải admin hoặc leader -> từ chối
    if (!isAdmin && !isLeader) {
        console.error(` Người dùng không có quyền xem danh sách lời mời - userId=${userId}`);
        throw new Error("Bạn không có quyền xem danh sách lời mời (chỉ leader hoặc admin).");
    }

    // 4️ Lấy danh sách lời mời
    const invitations = await prisma.groupInvitation.findMany({
        where: { groupId },
    });

  //  console.log(`SUCCESS: Lấy danh sách lời mời thành công - Tổng số = ${invitations.length}`);
    return invitations;
}


  // 15) lockGroup
  async lockGroup(groupId: string, userId: string) {
   // console.log(`DEBUG: Bắt đầu lockGroup - groupId=${groupId}, userId=${userId}`);

    // 1️ Kiểm tra thông tin user
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } },
    });

    if (!user) {
        console.error(` Không tìm thấy user - userId=${userId}`);
        throw new Error("Người dùng không tồn tại.");
    }

    const userRoles = user.roles.map(r => r.role.name.toLowerCase());
    const isAdmin = userRoles.includes("admin");

    // 2️ Kiểm tra xem user có phải leader của nhóm không
    const student = await prisma.student.findUnique({ where: { userId } });
    let isLeader = false;

    if (student) {
        const leader = await prisma.groupMember.findFirst({
            where: { groupId, studentId: student.id, role: "leader", isActive: true },
        });
        if (leader) isLeader = true;
    }

    // 3️ Nếu không phải admin hoặc leader -> từ chối
    if (!isAdmin && !isLeader) {
        console.error(` Người dùng không có quyền khóa nhóm - userId=${userId}`);
        throw new Error("Bạn không có quyền khóa nhóm (chỉ leader hoặc admin).");
    }

    // 4️ Tìm group
    const group = await prisma.group.findUnique({
        where: { id: groupId },
    });
    if (!group) throw new Error("Nhóm không tồn tại.");

    // 5️ Nếu nhóm đã bị khóa, không cần cập nhật lại
    if (group.isLocked) {
        console.warn(`Nhóm đã được khóa trước đó - groupId=${groupId}`);
        return { message: "Nhóm đã được khóa trước đó." };
    }

    // 6️ Cập nhật cột isLocked = true
    await prisma.group.update({
        where: { id: groupId },
        data: { isLocked: true },
    });

  //  console.log(`SUCCESS: Nhóm đã được khóa thành công - groupId=${groupId}`);
    return { message: "Nhóm đã được khóa thành công." };
}



  // 16) updateGroup
  async updateGroup(groupId: string, data: any, userId: string) {
  //  console.log(`DEBUG: Bắt đầu updateGroup - groupId=${groupId}, userId=${userId}`);

    // 1️ Kiểm tra thông tin user
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } },
    });

    if (!user) {
        console.error(` Không tìm thấy user - userId=${userId}`);
        throw new Error("Người dùng không tồn tại.");
    }

    const userRoles = user.roles.map(r => r.role.name.toLowerCase());
    const isAdmin = userRoles.includes("admin");

    // 2️ Kiểm tra xem user có phải leader của nhóm không
    const student = await prisma.student.findUnique({ where: { userId } });
    let isLeader = false;

    if (student) {
        const leader = await prisma.groupMember.findFirst({
            where: { groupId, studentId: student.id, role: "leader", isActive: true },
        });
        if (leader) isLeader = true;
    }

    // 3️ Nếu không phải admin hoặc leader -> từ chối
    if (!isAdmin && !isLeader) {
        console.error(`ERROR: Người dùng không có quyền cập nhật nhóm - userId=${userId}`);
        throw new Error("Bạn không có quyền cập nhật nhóm (chỉ leader hoặc admin).");
    }

    // 4️ Tìm group
    const group = await prisma.group.findUnique({
        where: { id: groupId },
    });
    if (!group) throw new Error("Nhóm không tồn tại.");

    // 5️ Cập nhật thông tin nhóm
    await prisma.group.update({
        where: { id: groupId },
        data,
    });

   // console.log(`SUCCESS: Nhóm ${groupId} đã được cập nhật.`);
    return { message: "Nhóm đã được cập nhật thành công." };
  }

  // 17) updateMentor
  async updateMentor(
    groupId: string,
    oldMentorId: string,
    newMentorId: string,
    userId: string
  ) {
  //  console.log(
  //    `DEBUG: Bắt đầu updateMentor - groupId=${groupId}, oldMentorId=${oldMentorId}, newMentorId=${newMentorId}, userId=${userId}`
   // );
  
    // 1️ Kiểm tra thông tin user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
  
    if (!user) {
      console.error(`ERROR: Không tìm thấy user - userId=${userId}`);
      throw new Error("Người dùng không tồn tại.");
    }
  
    const userRoles = user.roles.map((r) => r.role.name.toLowerCase());
    const isAdmin = userRoles.includes("admin");
  
    // 2️ Chỉ admin mới có quyền cập nhật mentor
    if (!isAdmin) {
      console.error(`Không có quyền cập nhật mentor - userId=${userId}`);
      throw new Error("Bạn không có quyền thay đổi mentor (chỉ admin).");
    }
  
    // 3️ Tìm group
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { mentor1Id: true, mentor2Id: true },
    });
  
    if (!group) {
      console.error(` Nhóm không tồn tại - groupId=${groupId}`);
      throw new Error("Nhóm không tồn tại.");
    }
  
    // 4️ Xác định mentor cần thay thế
    let mentorSlot: "mentor1Id" | "mentor2Id" | null = null;
    if (group && group.mentor1Id === oldMentorId) {
      mentorSlot = "mentor1Id";
    } else if (group.mentor2Id === oldMentorId) {
      mentorSlot = "mentor2Id";
    }
  
    if (!mentorSlot) {
      console.error(
        ` Mentor cũ không phải mentor1 hoặc mentor2 - oldMentorId=${oldMentorId}`
      );
      throw new Error("Mentor cũ không phải mentor1 hoặc mentor2.");
    }
  
    // 5️ Kiểm tra mentor mới có hợp lệ không (có phải user hệ thống và có role mentor không)
    const newMentor = await prisma.user.findUnique({
      where: { id: newMentorId },
      include: { roles: { include: { role: true } } },
    });
  
    if (!newMentor) {
      console.error(` Mentor mới không tồn tại - newMentorId=${newMentorId}`);
      throw new Error("Mentor mới không tồn tại.");
    }
  
    const isNewMentorValid = newMentor.roles.some((r) => r.role.name === "mentor");
    if (!isNewMentorValid) {
      console.error(` Người dùng này không phải mentor - newMentorId=${newMentorId}`);
      throw new Error("Người dùng này không phải Mentor.");
    }
  
    // 6️ Cập nhật mentor trong nhóm
    const updateData: any = {};
    updateData[mentorSlot] = newMentorId;
  
    await prisma.group.update({
      where: { id: groupId },
      data: updateData,
    });
  
    console.log(`Mentor cũ đã được thay thế - mentorSlot=${mentorSlot}, newMentorId=${newMentorId}`);
  
    // 7️ Xoá mentor cũ khỏi groupMember
    await prisma.groupMember.deleteMany({
      where: { groupId, userId: oldMentorId, role: "mentor" },
    });
  
    // 8️ Thêm mentor mới vào groupMember (hoặc cập nhật nếu đã có)
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
  
   // console.log(`SUCCESS: Đã thay đổi mentor thành công - groupId=${groupId}`);
    return { message: "Đã thay đổi mentor thành công." };
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
  const isAdmin = userRoles.includes("admin");

  // 2️ Kiểm tra xem user có phải leader của nhóm không
  const student = await prisma.student.findUnique({ where: { userId } });
  let isLeader = false;

  if (student) {
      const leader = await prisma.groupMember.findFirst({
          where: { groupId, studentId: student.id, role: "leader", isActive: true },
      });
      if (leader) isLeader = true;
  }

  // 3️ Nếu không phải admin hoặc leader -> từ chối
  if (!isAdmin && !isLeader) {
      console.error(` Người dùng không có quyền xem thành viên nhóm - userId=${userId}`);
      throw new Error("Bạn không có quyền xem thành viên nhóm (chỉ leader hoặc admin).");
  }

  // 4️ Lấy danh sách thành viên nhóm
  const members = await prisma.groupMember.findMany({
      where: { groupId },
  });

 // console.log(`SUCCESS: Lấy danh sách thành viên nhóm thành công - Tổng số = ${members.length}`);
  return members;
}

  


}