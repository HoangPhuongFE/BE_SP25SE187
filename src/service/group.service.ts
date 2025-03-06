import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../utils/email";
import { GROUP_MESSAGE, USER_MESSAGE, EMAIL_MESSAGE } from "../constants/message";
import { SystemConfigService } from "../service/system.config.service";
import HTTP_STATUS from '../constants/httpStatus';

const prisma = new PrismaClient();
const systemConfigService = new SystemConfigService();

export class GroupService {
    // 1) Tạo nhóm
    async createGroup(leaderId: string, semesterId: string) {
        const leader = await prisma.student.findUnique({
            where: { userId: leaderId },
            include: { major: true },
        });

        if (!leader) {
            return {
                success: false,
                status: HTTP_STATUS.NOT_FOUND,
                message: GROUP_MESSAGE.STUDENT_NOT_FOUND
            };
        }

        // Kiểm tra sinh viên có trong học kỳ không
        const studentSemester = await prisma.semesterStudent.findFirst({
            where: { studentId: leader.id, semesterId },
        });

        if (!studentSemester) {
            return {
                success: false,
                status: HTTP_STATUS.BAD_REQUEST,
                message: GROUP_MESSAGE.STUDENT_NOT_IN_SEMESTER
            };
        }

        // Kiểm tra điều kiện tham gia nhóm
        if (studentSemester.qualificationStatus.trim().toLowerCase() !== "qualified") {
            return {
                success: false,
                status: HTTP_STATUS.BAD_REQUEST,
                message: `${GROUP_MESSAGE.STUDENT_NOT_QUALIFIED} Trạng thái hiện tại: ${studentSemester.qualificationStatus}`
            };
        }

        // Tạo mã nhóm
        const currentYear = new Date().getFullYear();
        const lastTwoDigits = currentYear.toString().slice(-2);
        const majorName = (leader.major?.name || "").trim();
        const majorCode = majorName.split(" ").map(word => word[0]).join("").toUpperCase();
        const groupCodePrefix = `G${lastTwoDigits}${majorCode}`;

        const count = await prisma.group.count({
            where: { semesterId, groupCode: { startsWith: groupCodePrefix } },
        });

        const sequenceNumber = (count + 1).toString().padStart(3, "0");
        const groupCode = groupCodePrefix + sequenceNumber;

        // Lấy số lượng tối đa thành viên nhóm từ config
        const maxMembers = await systemConfigService.getMaxGroupMembers();

        // Tạo nhóm và thêm leader
        const newGroup = await prisma.group.create({
            data: {
                groupCode,
                semesterId,
                status: "ACTIVE",
                createdBy: leaderId,
                maxMembers,
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
            success: true,
            status: HTTP_STATUS.CREATED,
            message: GROUP_MESSAGE.GROUP_CREATED,
            data: newGroup
        };
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
          //  console.log("DEBUG: inviteMember() - Nhận request với:");
         //   console.log("groupId:", groupId, "groupCode:", groupCode, "studentEmail:", studentEmail, "studentId:", studentId);
    
            // 1️ Tìm sinh viên theo studentId hoặc email
            const invitedStudent = studentId
                ? await prisma.student.findUnique({
                    where: { id: studentId },
                    include: { user: true, major: true },
                })
                : studentEmail
                ? await prisma.student.findFirst({
                    where: { user: { email: studentEmail } },
                    include: { user: true, major: true },
                })
                : null;
    
            if (!invitedStudent) {
                return {
                    success: false,
                    status: HTTP_STATUS.NOT_FOUND,
                    message: `Không tìm thấy sinh viên với ${studentId ? `ID: ${studentId}` : `email: ${studentEmail}`}`
                };
            }
    
            // 2️ Tìm thông tin người mời
            const inviter = await prisma.user.findUnique({
                where: { id: invitedById },
                include: { roles: { include: { role: true } } },
            });
    
            if (!inviter) {
                return {
                    success: false,
                    status: HTTP_STATUS.NOT_FOUND,
                    message: `Người mời không tồn tại với ID=${invitedById}`
                };
            }
    
            // 3️ Kiểm tra quyền của người mời
            const userRoles = inviter.roles.map((r) => r.role.name.toLowerCase());
            if (!userRoles.includes("admin")) {
                const inviterStudent = await prisma.student.findFirst({ where: { userId: invitedById } });
                const isLeader = await prisma.groupMember.findFirst({
                    where: { 
                        groupId: groupId || undefined, 
                        studentId: inviterStudent?.id, 
                        role: "leader", 
                        isActive: true 
                    },
                });
    
                const isMentor = await prisma.groupMentor.findFirst({
                    where: { 
                        groupId: groupId || undefined, 
                        mentorId: invitedById 
                    },
                });
    
                if (!isLeader && !isMentor) {
                    return {
                        success: false,
                        status: HTTP_STATUS.FORBIDDEN,
                        message: GROUP_MESSAGE.NO_PERMISSION_INVITE
                    };
                }
            }
    
            // 4️ Kiểm tra nhóm có tồn tại không
            const whereClause = groupId
                ? { id: groupId }
                : groupCode
                ? { groupCode: groupCode }
                : undefined;
    
            if (!whereClause) {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: "Cần cung cấp groupId hoặc groupCode hợp lệ."
                };
            }
    
            const group = await prisma.group.findFirst({
                where: whereClause,
                include: { members: { include: { student: { include: { major: true } } } } },
            });
    
            if (!group) {
                return {
                    success: false,
                    status: HTTP_STATUS.NOT_FOUND,
                    message: GROUP_MESSAGE.GROUP_NOT_FOUND
                };
            }
    
            if (group.isLocked) {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: GROUP_MESSAGE.GROUP_LOCKED
                };
            }
    
            // 5️ Kiểm tra số lượng thành viên nhóm
            const maxMembers = await systemConfigService.getMaxGroupMembers();
            if (group.members.length >= maxMembers) {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: `${GROUP_MESSAGE.MAX_GROUP_MEMBERS_REACHED} (Tối đa ${maxMembers} người).`
                };
            }
    
            // 6️ Kiểm tra sinh viên đã trong nhóm chưa
            if (group.members.some((m: any) => m.studentId === invitedStudent.id)) {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: GROUP_MESSAGE.MEMBER_ALREADY_EXISTS
                };
            }
    
            // 7️ Kiểm tra điều kiện tham gia nhóm
            const studentSemester = await prisma.semesterStudent.findFirst({
                where: { studentId: invitedStudent.id, semesterId: group.semesterId },
            });
    
            if (!studentSemester || studentSemester.qualificationStatus.trim().toLowerCase() !== "qualified") {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: GROUP_MESSAGE.STUDENT_NOT_QUALIFIED
                };
            }
    
            // 8️ Kiểm tra ngành học có khớp nhóm không
            if (group.members.length > 0) {
                const groupMajor = group.members[0]?.student?.major?.id;
                if (invitedStudent.major?.id && groupMajor && invitedStudent.major.id !== groupMajor) {
                    return {
                        success: false,
                        status: HTTP_STATUS.BAD_REQUEST,
                        message: GROUP_MESSAGE.GROUP_MAJOR_MISMATCH
                    };
                }
            }
    
            //  Kiểm tra lời mời trước đó
            const existingInvitation = await prisma.groupInvitation.findFirst({
                where: { groupId: group.id, studentId: invitedStudent.id, status: "PENDING" },
            });
    
            if (existingInvitation) {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: GROUP_MESSAGE.INVITATION_EXISTS
                };
            }
    
            //  Tạo lời mời
        const invitation = await prisma.groupInvitation.create({
            data: { groupId: group.id, studentId: invitedStudent.id, status: "PENDING" },
        });

        // 6️ **Gửi email lời mời**
        if (invitedStudent.user?.email) {
            const invitationLink = `http://160.187.241.152:6969/api/groups/accept-invitation/${invitation.id}`;
            const emailContent = `
                <p>Xin chào ${invitedStudent.user.fullName || invitedStudent.user.username},</p>
                <p>Bạn đã được mời tham gia nhóm <b>${group.groupCode}</b>. Click vào link để chấp nhận lời mời:</p>
                <a href="${invitationLink}">Chấp nhận lời mời</a>
            `;

            try {
                await sendEmail({ to: invitedStudent.user.email, subject: "Lời mời tham gia nhóm", html: emailContent });
                return {
                    success: true,
                    status: HTTP_STATUS.OK,
                    message: GROUP_MESSAGE.INVITATION_SENT,
                    data: { invitation, invitationLink }
                };
            } catch (error) {
                console.error(`Lỗi gửi email cho ${invitedStudent.user.email}:`, error);
                return {
                    success: false,
                    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
                    message: EMAIL_MESSAGE.EMAIL_FAILED
                };
            }
        }

        return {
            success: true,
            status: HTTP_STATUS.OK,
            message: GROUP_MESSAGE.INVITATION_SENT,
            data: invitation
        };

    
        } catch (error) {
            console.error("Lỗi trong inviteMember:", error);
            return {
                success: false,
                status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
                message: "Lỗi hệ thống khi mời thành viên."
            };
        }
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
            return {
                success: false,
                status: HTTP_STATUS.UNAUTHORIZED,
                message: USER_MESSAGE.UNAUTHORIZED
            };
        }

        // Tìm lời mời
        const invitation = await prisma.groupInvitation.findUnique({
            where: { id: invitationId },
            include: { group: true },
        });

        if (!invitation) {
            return {
                success: false,
                status: HTTP_STATUS.NOT_FOUND,
                message: GROUP_MESSAGE.INVITATION_NOT_FOUND
            };
        }

        // Kiểm tra quyền xử lý lời mời
        if (invitation.studentId !== student.id) {
            return {
                success: false,
                status: HTTP_STATUS.FORBIDDEN,
                message: USER_MESSAGE.UNAUTHORIZED
            };
        }

        // Cập nhật trạng thái lời mời
        const updatedInvitation = await prisma.groupInvitation.update({
            where: { id: invitationId },
            data: { status: response, respondedAt: new Date() },
        });

        // Nếu lời mời được chấp nhận, thêm sinh viên vào nhóm
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
                success: true,
                status: HTTP_STATUS.OK,
                message: GROUP_MESSAGE.INVITATION_ACCEPTED,
                data: updatedInvitation
            };
        }

        // Nếu lời mời bị từ chối
        return {
            success: true,
            status: HTTP_STATUS.OK,
            message: GROUP_MESSAGE.INVITATION_REJECTED,
            data: updatedInvitation
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
                    id: {
                        in: (
                            await prisma.groupMentor.findMany({
                                where: { mentorId: userId },
                                select: { groupId: true },
                            })
                        ).map((gm) => gm.groupId),
                    },
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
    async changeLeader(
        groupId: string | undefined,
        groupCode: string | undefined,
        newLeaderId: string | undefined,
        newLeaderEmail: string | undefined,
        userId: string
    ) {
        // 1️⃣ Kiểm tra nhóm có tồn tại không (tìm theo groupId hoặc groupCode)
        const whereClause = groupId
            ? { id: groupId }
            : groupCode
            ? { groupCode: groupCode }
            : undefined;
    
        if (!whereClause) {
            throw new Error("Cần cung cấp groupId hoặc groupCode hợp lệ.");
        }
    
        const group = await prisma.group.findFirst({
            where: whereClause,
            include: { members: { include: { student: { include: { user: true } } } } },
        });
    
        if (!group) throw new Error("Nhóm không tồn tại.");
        if (group.isLocked) throw new Error("Nhóm đã bị khóa. Không thể thay đổi leader.");
    
        // 2️⃣ Kiểm tra quyền của người thực hiện thay đổi
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { roles: { include: { role: true } } },
        });
    
        if (!user) throw new Error("Người dùng không tồn tại.");
        const userRoles = user.roles.map((r) => r.role.name.toLowerCase());
        const isAdmin = userRoles.includes("admin");
    
        let isAuthorized = isAdmin;
        const student = await prisma.student.findUnique({ where: { userId } });
    
        if (student) {
            const isLeader = await prisma.groupMember.findFirst({
                where: { groupId: group.id, studentId: student.id, role: "leader", isActive: true },
            });
            if (isLeader) isAuthorized = true;
        }
    
        const isMentor = await prisma.groupMentor.findFirst({ where: { groupId: group.id, mentorId: userId } });
    
        if (isMentor) isAuthorized = true;
    
        if (!isAuthorized) throw new Error("Bạn không có quyền đổi leader.");
    
        // 3️⃣ Tìm leader mới (theo newLeaderId hoặc email)
        let newLeader = newLeaderId
        ? group.members.find((m) => m.student?.id === newLeaderId)
        : null;
    
    if (!newLeader && newLeaderEmail) {
        newLeader = group.members.find((m) => m.student?.user?.email === newLeaderEmail);
    }
    
    
        if (!newLeader) {
            throw new Error("Người dùng này không thuộc nhóm hoặc không hợp lệ.");
        }
    
        // 4️⃣ Đổi tất cả thành viên thành "member"
        await prisma.groupMember.updateMany({
            where: { groupId: group.id },
            data: { role: "member" },
        });
    
        // 5️⃣ Cập nhật leader mới
        await prisma.groupMember.update({
            where: { id: newLeader.id },
            data: { role: "leader" },
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
        // 1️ Kiểm tra nhóm có tồn tại không (tìm theo groupId hoặc groupCode)
        const whereClause = groupId
            ? { id: groupId }
            : groupCode
            ? { groupCode: groupCode }
            : undefined;
    
        if (!whereClause) {
            throw new Error("Cần cung cấp groupId hoặc groupCode hợp lệ.");
        }
    
        const group = await prisma.group.findFirst({
            where: whereClause,
            include: { mentors: true },
        });
    
        if (!group) throw new Error("Nhóm không tồn tại.");
        if (group.isLocked) throw new Error("Nhóm đã bị khóa. Không thể thêm mentor.");
    
        // 2️ Kiểm tra số lượng mentor trong nhóm
        const mentorCount = await prisma.groupMentor.count({ where: { groupId: group.id } });
    
        const maxMentors = await systemConfigService.getMaxGroupMentors();
        if (mentorCount >= maxMentors) {
            throw new Error(`Nhóm đã đủ mentor (tối đa ${maxMentors} mentor).`);
        }
    
        // 3️ Kiểm tra quyền của người thêm mentor
        const user = await prisma.user.findUnique({
            where: { id: addedBy },
            include: { roles: { include: { role: true } } },
        });
    
        if (!user) throw new Error("Người dùng không tồn tại.");
        const userRoles = user.roles.map(r => r.role.name.toLowerCase());
        const isAdmin = userRoles.includes("admin") || userRoles.includes("graduation_thesis_manager") || userRoles.includes("academic_officer");
    
        const student = await prisma.student.findUnique({ where: { userId: addedBy } });
        let isAuthorized = isAdmin;
    
        if (student) {
            const leader = await prisma.groupMember.findFirst({
                where: { groupId: group.id, studentId: student.id, role: "leader", isActive: true },
            });
            if (leader) isAuthorized = true;
        }
    
        const mentorInGroup = await prisma.groupMentor.findFirst({ where: { groupId: group.id, mentorId: addedBy } });
        if (mentorInGroup) isAuthorized = true;
    
        if (!isAuthorized) throw new Error("Bạn không có quyền thêm mentor vào nhóm.");
    
        // 4️ Tìm mentor (bằng mentorId hoặc email)
        let mentorUser = mentorId
            ? await prisma.user.findUnique({ where: { id: mentorId }, include: { roles: { include: { role: true } } } })
            : null;
    
        if (!mentorUser && mentorEmail) {
            mentorUser = await prisma.user.findFirst({ where: { email: mentorEmail }, include: { roles: { include: { role: true } } } });
        }
    
        if (!mentorUser || !mentorUser.roles.some(r => r.role.name === "lecturer")) {
            throw new Error("Người dùng này không phải Mentor hoặc không tồn tại.");
        }
    
        // 5️ Kiểm tra mentor đã có trong nhóm chưa
        const existingMentor = await prisma.groupMentor.findFirst({ where: { groupId: group.id, mentorId: mentorUser.id } });
    
        if (existingMentor) throw new Error("Mentor đã có trong nhóm.");
    
        // 6️ Thêm mentor vào nhóm
        await prisma.groupMentor.create({
            data: { groupId: group.id, mentorId: mentorUser.id, addedBy },
        });
    
        return { message: "Mentor đã được thêm vào nhóm thành công." };
    }
    


    // 10) removeMemberFromGroup
    async removeMemberFromGroup(groupId: string, memberId: string, invitedById: string) {
        //  Kiểm tra nhóm có bị khóa không
        const group = await prisma.group.findUnique({ where: { id: groupId } });
        if (!group) throw new Error("Nhóm không tồn tại.");
        if (group.isLocked) throw new Error("Nhóm đã bị khóa. Không thể xoá thành viên.");

        //  Lấy thông tin user thực hiện xóa
        const user = await prisma.user.findUnique({
            where: { id: invitedById },
            include: { roles: { include: { role: true } } },
        });

        if (!user) throw new Error("Người dùng không tồn tại.");

        //  Kiểm tra quyền của người dùng
        const userRoles = user.roles.map((r) => r.role.name.toLowerCase());
        const isAdmin = userRoles.includes("admin, graduation_thesis_manager, academic_officer");

        //  Nếu là Admin => Bỏ qua kiểm tra actingStudent
        let isLeader = false;
        if (!isAdmin) {
            const actingStudent = await prisma.student.findUnique({
                where: { userId: invitedById },
                select: { id: true },
            });

            if (!actingStudent) throw new Error("Người dùng không phải sinh viên.");

            isLeader = !!(await prisma.groupMember.findFirst({
                where: { groupId, studentId: actingStudent.id, role: "leader", isActive: true },
            }));
        }

        //  Chỉ Admin hoặc Leader mới có thể xóa thành viên
        if (!isAdmin && !isLeader) {
            throw new Error("Bạn không có quyền xoá thành viên khỏi nhóm (chỉ leader hoặc admin).");
        }

        //  Kiểm tra xem thành viên cần xóa có trong nhóm không
        const member = await prisma.groupMember.findFirst({
            where: { groupId, studentId: memberId },
        });

        if (!member) throw new Error("Thành viên không tồn tại trong nhóm.");

        //  Không cho phép Leader tự xóa chính mình
        if (isLeader && member.studentId === invitedById) {
            throw new Error("Leader không thể tự xoá chính mình khỏi nhóm. Hãy đổi leader trước.");
        }

        //  Xóa thành viên khỏi nhóm
        await prisma.groupMember.delete({ where: { id: member.id } });

        return { message: "Xoá thành viên khỏi nhóm thành công." };
    }




    // 11) deleteGroup
    async deleteGroup(groupId: string, userId: string) {
       // console.log("CHECKING USER PERMISSION:", userId);
      //  console.log("DELETING GROUP ID:", groupId);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { roles: { include: { role: true } } },
        });

        if (!user) {
            console.error("User not found:", userId);
            throw new Error("Người dùng không tồn tại.");
        }

        const userRoles = user.roles.map((r) => r.role.name.toLowerCase());
        const isAdmin = userRoles.includes("admin");

        const student = await prisma.student.findUnique({ where: { userId } });
        let isLeader = false;

        if (student) {
            const leader = await prisma.groupMember.findFirst({
                where: { groupId, studentId: student.id, role: "leader", isActive: true },
            });
            if (leader) isLeader = true;
        }

        console.log("USER ROLES:", userRoles);
        console.log("IS ADMIN:", isAdmin);
        console.log("IS LEADER:", isLeader);

        if (!isAdmin && !isLeader) {
            throw new Error("Bạn không có quyền xoá nhóm (chỉ leader hoặc admin).");
        }

        // Kiểm tra nhóm có tồn tại không
        const group = await prisma.group.findUnique({
            where: { id: groupId },
            include: { members: true },
        });

        console.log("GROUP FOUND:", group);

        if (!group) {
            console.error("Group not found:", groupId);
            throw new Error("Nhóm không tồn tại.");
        }

        // Nếu không phải admin, kiểm tra xem nhóm có thành viên khác không
        if (!isAdmin && group.members.length > 1) {
            console.error("Group still has members, only admin can delete.");
            throw new Error("Nhóm vẫn còn thành viên, chỉ admin mới có thể xoá.");
        }

        // Xóa dữ liệu liên quan
        await prisma.groupMentor.deleteMany({ where: { groupId } });
        await prisma.groupInvitation.deleteMany({ where: { groupId } });
        await prisma.groupMember.deleteMany({ where: { groupId } });

        await prisma.group.delete({ where: { id: groupId } });

     //   console.log("GROUP DELETED SUCCESSFULLY");
        return { message: "Nhóm đã được xoá thành công." };
    }




    // 12) leaveGroup
    async leaveGroup(groupId: string, userId: string) {
        // 1️ Kiểm tra nhóm có bị khóa không
        const group = await prisma.group.findUnique({ where: { id: groupId } });
        if (!group) throw new Error("Nhóm không tồn tại.");
        if (group.isLocked) throw new Error("Nhóm đã bị khóa. Không thể rời nhóm.");

        // 2️ Kiểm tra người dùng có tồn tại không
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("Người dùng không tồn tại.");

        // 3️ Tìm membership trong nhóm
        const student = await prisma.student.findUnique({ where: { userId } });
        let member = null;

        if (student) {
            // Nếu user là sinh viên
            member = await prisma.groupMember.findFirst({
                where: { groupId, studentId: student.id },
            });
        }

        // Nếu user là mentor
        const isMentor = await prisma.groupMentor.findFirst({
            where: { groupId, mentorId: userId },
        });

        if (!member && !isMentor) {
            throw new Error("Bạn không thuộc nhóm này.");
        }

        // 4️ Không cho phép leader rời nhóm
        if (member && member.role === "leader") {
            throw new Error("Leader không thể tự rời nhóm. Hãy đổi leader trước.");
        }

        // 5️ Nếu user là mentor, kiểm tra số lượng mentor trong nhóm
        if (isMentor) {
            const mentorCount = await prisma.groupMentor.count({ where: { groupId } });
            if (mentorCount <= 1) {
                throw new Error("Bạn là mentor duy nhất, không thể rời nhóm. Hãy thay thế mentor trước.");
            }
        }

        // 6️ Xoá record groupMember nếu user là thành viên
        if (member) {
            await prisma.groupMember.delete({ where: { id: member.id } });
        }

        // 7️ Xoá record groupMentor nếu user là mentor
        if (isMentor) {
            await prisma.groupMentor.delete({ where: { id: isMentor.id } });
        }

        return { message: "Bạn đã rời nhóm thành công." };
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
        // 1️ Kiểm tra thông tin user
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { roles: { include: { role: true } } },
        });

        if (!user) throw new Error("Người dùng không tồn tại.");

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

        // 3️ Kiểm tra user có phải mentor trong nhóm không
        const isMentor = await prisma.groupMentor.findFirst({
            where: { groupId, mentorId: userId },
        });

        // 4️ Chỉ cho phép admin, leader hoặc mentor khóa nhóm
        if (!isAdmin && !isLeader && !isMentor) {
            throw new Error("Bạn không có quyền khóa nhóm (chỉ admin, leader hoặc mentor).");
        }

        // 5️ Tìm group
        const group = await prisma.group.findUnique({
            where: { id: groupId },
        });

        if (!group) throw new Error("Nhóm không tồn tại.");

        // 6️ Nếu nhóm đã bị khóa, không cần cập nhật lại
        if (group.isLocked) {
            return { message: "Nhóm đã được khóa trước đó." };
        }

        // 7️ Cập nhật trạng thái khóa nhóm
        await prisma.group.update({
            where: { id: groupId },
            data: { isLocked: true },
        });

        return { message: "Nhóm đã được khóa thành công." };
    }





    // 17) updateMentor
    async updateMentor(
        groupId: string,
        oldMentorId: string,
        newMentorId: string,
        userId: string
    ) {
        // 1️ Kiểm tra nhóm có tồn tại không
        const group = await prisma.group.findUnique({ where: { id: groupId } });
        if (!group) throw new Error("Nhóm không tồn tại.");

        // 2️ Kiểm tra nhóm có bị khóa không
        if (group.isLocked) {
            throw new Error("Nhóm đã bị khóa, không thể thay đổi mentor.");
        }

        // 3️ Kiểm tra quyền của user thực hiện thay đổi mentor
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { roles: { include: { role: true } } },
        });

        if (!user) throw new Error("Người dùng không tồn tại.");

        const userRoles = user.roles.map((r) => r.role.name.toLowerCase());
        const isAdmin = userRoles.includes("admin");

        // Kiểm tra user có phải mentor trong nhóm không
        const isMentor = await prisma.groupMentor.findFirst({
            where: { groupId, mentorId: userId },
        });

        if (!isAdmin && !isMentor) {
            throw new Error("Bạn không có quyền thay đổi mentor.");
        }

        // 4️ Kiểm tra mentor cũ có trong nhóm không
        const oldMentor = await prisma.groupMentor.findFirst({
            where: { groupId, mentorId: oldMentorId },
        });

        if (!oldMentor) {
            throw new Error("Mentor cũ không thuộc nhóm.");
        }

        // 5️ Kiểm tra số lượng mentor hiện tại trong nhóm
        const mentorCount = await prisma.groupMentor.count({ where: { groupId } });

        if (mentorCount <= 1) {
            throw new Error("Mentor cũ là mentor duy nhất trong nhóm. Hãy thêm mentor mới trước khi xóa mentor cũ.");
        }

        // 6️ Kiểm tra mentor mới có hợp lệ không
        const newMentor = await prisma.user.findUnique({
            where: { id: newMentorId },
            include: { roles: { include: { role: true } } },
        });

        if (!newMentor || !newMentor.roles.some((r) => r.role.name === "mentor")) {
            throw new Error("Người dùng này không phải Mentor.");
        }

        // 7️ Kiểm tra mentor mới đã có trong nhóm chưa
        const existingMentor = await prisma.groupMentor.findFirst({
            where: { groupId, mentorId: newMentorId },
        });

        if (existingMentor) {
            throw new Error("Mentor mới đã có trong nhóm.");
        }

        // 8️ Xóa mentor cũ
        await prisma.groupMentor.delete({ where: { id: oldMentor.id } });

        // 9️ Thêm mentor mới
        await prisma.groupMentor.create({
            data: {
                groupId,
                mentorId: newMentorId,
                addedBy: userId,
            },
        });

        return { message: "Mentor đã được cập nhật thành công." };
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
        // 1️ Lấy thông tin user + vai trò
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { roles: { include: { role: true } } },
        });

        if (!user) throw new Error("Người dùng không tồn tại.");

        const userRoles = user.roles.map(r => r.role.name.toLowerCase());
        const isAdmin = userRoles.includes("admin");
        const isAcademicOfficer = userRoles.includes("academic_officer");

        // 2️ Kiểm tra quyền mở khóa (chỉ admin hoặc academic_officer)
        if (!isAdmin && !isAcademicOfficer) {
            throw new Error("Bạn không có quyền mở khóa nhóm.");
        }

        // 3️ Kiểm tra xem nhóm có bị khóa không
        const group = await prisma.group.findUnique({
            where: { id: groupId },
        });

        if (!group) throw new Error("Nhóm không tồn tại.");
        if (!group.isLocked) {
            return { message: "Nhóm hiện không bị khóa." };
        }

        // 4️Mở khóa nhóm
        await prisma.group.update({
            where: { id: groupId },
            data: { isLocked: false },
        });

        return { message: "Nhóm đã được mở khóa thành công." };
    }


}