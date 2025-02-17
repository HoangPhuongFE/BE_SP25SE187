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


async  randomizeGroups(semesterId: string, createdBy: string) {
  // Lấy danh sách sinh viên đủ điều kiện, chưa có nhóm
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
      specialization: true 
    },
  });
  
  if (students.length === 0) {
    throw new Error("Không có sinh viên nào đủ điều kiện để tạo nhóm.");
  }

  // Nhóm sinh viên theo ngành học (Profession)
  const groupedByMajor: { [key: string]: typeof students } = {};
  students.forEach(student => {
    const major = student.major?.name || "Unknown";
    if (!groupedByMajor[major]) {
      groupedByMajor[major] = [];
    }
    groupedByMajor[major].push(student);
  });

  let groups: any[] = [];
  let groupCounter = 1;

  for (const major in groupedByMajor) {
    let studentsInMajor = groupedByMajor[major];

    // Nhóm theo chuyên môn (FE, BE, FS)
    let feStudents = students.filter(s => s.user?.programming_language === "Front-end");
    let beStudents = students.filter(s => s.user?.programming_language === "Back-end");
    let fsStudents = students.filter(s => s.user?.programming_language === "Full-stack");
    

    while (studentsInMajor.length > 0) {
      let groupMembers = [];

      // Thêm 1 BE, 1 FE vào nhóm trước
      if (beStudents.length > 0) groupMembers.push(beStudents.pop());
      if (feStudents.length > 0) groupMembers.push(feStudents.pop());

      // Nếu còn slot, ưu tiên thêm FS
      if (fsStudents.length > 0 && groupMembers.length < 5) groupMembers.push(fsStudents.pop());

      // Nếu nhóm chưa đủ 4, lấy ngẫu nhiên từ danh sách còn lại
      while (groupMembers.length < 4 && studentsInMajor.length > 0) {
        groupMembers.push(studentsInMajor.pop());
      }

      // Nếu nhóm chưa đạt tối thiểu 4 thành viên, bỏ qua
      if (groupMembers.length < 4) break;

      // Tạo mã nhóm dựa trên năm và mã ngành (VD: G-25-SE-01)
      const majorCode = major === "Software Engineering" ? "SE" : major.slice(0, 2).toUpperCase();
      const yearSuffix = new Date().getFullYear().toString().slice(-2);
      const groupCode = `G-${yearSuffix}-${majorCode}-${String(groupCounter).padStart(2, "0")}`;
      groupCounter++;

      // Tạo nhóm trong database
      const newGroup = await prisma.group.create({
        data: {
          groupCode,
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
  }

  return { message: "Random nhóm thành công!", data: groups };
}


async changeLeader(req: AuthenticatedRequest, res: Response, userId: string) {
  try {
    const { groupId, newLeaderId } = req.body;

    if (!groupId || !newLeaderId) {
      return res.status(400).json({ message: "Thiếu groupId hoặc newLeaderId." });
    }

    // Kiểm tra quyền của user (Admin hoặc Leader nhóm)
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { roles: { select: { role: true } } },
    });

    if (!user) {
      return res.status(403).json({ message: "Người dùng không tồn tại." });
    }

    const userRoles = user.roles.map(r => r.role.name);
    const isAdmin = userRoles.includes("admin");

    // Kiểm tra nhóm có tồn tại không
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) {
      return res.status(404).json({ message: "Nhóm không tồn tại." });
    }

    // Kiểm tra nếu user là leader hiện tại
    const currentLeader = group.members.find(m => m.role === "leader");
    const isLeader = currentLeader?.studentId === req.user!.userId;

    if (!isLeader && !isAdmin) {
      return res.status(403).json({ message: "Bạn không có quyền đổi leader." });
    }

    // Kiểm tra leader mới có thuộc nhóm không
    const newLeader = group.members.find(m => m.studentId === newLeaderId);
    if (!newLeader) {
      return res.status(400).json({ message: "Sinh viên này không thuộc nhóm." });
    }

    // Cập nhật leader mới
    await prisma.groupMember.updateMany({
      where: { groupId },
      data: { role: "member" } // Đổi tất cả về "member" trước
    });

    await prisma.groupMember.update({
      where: { id: newLeader.id },
      data: { role: "leader" }
    });

    // Ghi log thay đổi leader
    await prisma.systemLog.create({
      data: {
        userId: req.user!.userId,
        action: "CHANGE_LEADER",
        entityType: "GROUP",
        entityId: groupId,
        oldValues: { oldLeaderId: currentLeader?.studentId },
        newValues: { newLeaderId },
        createdAt: new Date(),
        ipAddress: req.ip || "Unknown",
      }
    });

    return res.status(200).json({ message: "Leader đã được thay đổi thành công." });

  } catch (error) {
    return res.status(500).json({ message: (error as Error).message });
  }
}



async addMentorToGroup(groupId: string, mentorId: string, userId: string) {
  // Kiểm tra nhóm có tồn tại không
  const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true }
  });

  if (!group) throw new Error("Nhóm không tồn tại.");

  //  Lấy số lượng mentor tối đa từ cấu hình hệ thống
  const maxMentorsAllowed = await ConfigService.getMaxMentorsPerGroup();

  //  Kiểm tra số mentor hiện tại
  const currentMentors = group.members.filter(m => m.role === "mentor").length;
  if (currentMentors >= maxMentorsAllowed) {
      throw new Error(`Nhóm đã đạt số lượng mentor tối đa (${maxMentorsAllowed}).`);
  }

  // Kiểm tra mentor có tồn tại không
  const mentor = await prisma.user.findUnique({ where: { id: mentorId } });
  if (!mentor) throw new Error("Không tìm thấy mentor.");

  //  Kiểm tra mentor có thuộc nhóm chưa
  const isAlreadyMentor = group.members.some(m => m.studentId === mentorId);
  if (isAlreadyMentor) throw new Error("Mentor đã có trong nhóm.");

  // Thêm mentor vào nhóm
  await prisma.groupMember.create({
      data: {
          groupId,
          studentId: mentorId,
          role: "mentor",
          status: "ACTIVE",
          joinedAt: new Date()
      }
  });

  return { message: "Mentor đã được thêm vào nhóm thành công." };
}

async removeMemberFromGroup(groupId: string, memberId: string, userId: string) {
  // Kiểm tra xem user có phải Leader/Mentor/Admin không
  const isAuthorized = await this.checkLeaderMentorOrAdmin(groupId, userId);
  if (!isAuthorized) {
    throw new Error("Bạn không có quyền xoá thành viên khỏi nhóm.");
  }

  // Kiểm tra xem thành viên có trong nhóm không
  const member = await prisma.groupMember.findFirst({
    where: { groupId, studentId: memberId },
  });

  if (!member) {
    throw new Error("Thành viên không tồn tại trong nhóm.");
  }

  // Kiểm tra nếu member là leader, không cho phép tự xoá chính mình
  if (member.role === "LEADER" && member.studentId === userId) {
    throw new Error("Leader không thể tự xoá chính mình khỏi nhóm.");
  }

  // Nếu member là MENTOR, chỉ admin mới có quyền xoá
  if (member.role === "MENTOR") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { select: { role: true } } },
    });

    if (!user?.roles.some(r => r.role.name === "admin")) {
      throw new Error("Chỉ admin mới có quyền xoá mentor khỏi nhóm.");
    }
  }

  // Xoá thành viên khỏi nhóm
  await prisma.groupMember.delete({
    where: { id: member.id },
  });

  return { message: "Xoá thành viên khỏi nhóm thành công." };
}

async deleteGroup(groupId: string, userId: string) {
  // Kiểm tra xem user có quyền không
  const isAuthorized = await this.checkLeaderMentorOrAdmin(groupId, userId);
  if (!isAuthorized) {
    throw new Error("Bạn không có quyền xoá nhóm.");
  }

  // Kiểm tra nhóm có tồn tại không
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true }, // Kiểm tra có thành viên không
  });

  if (!group) {
    throw new Error("Nhóm không tồn tại.");
  }

  // Nếu không phải admin, không cho xoá nhóm có thành viên
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { select: { role: true } } },
  });

  const isAdmin = user?.roles.some(r => r.role.name === "admin");
  if (!isAdmin && group.members.length > 0) {
    throw new Error("Nhóm vẫn còn thành viên, chỉ admin mới có thể xoá nhóm có thành viên.");
  }

  // Xoá tất cả thành viên trong nhóm
  await prisma.groupMember.deleteMany({ where: { groupId } });

  // Xoá nhóm
  await prisma.group.delete({ where: { id: groupId } });

  return { message: "Nhóm đã được xoá thành công." };
}



}
