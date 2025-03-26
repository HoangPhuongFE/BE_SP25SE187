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
        try {
            // 1. Kiểm tra học kỳ (bao gồm startDate để tạo mã nhóm)
            const semester = await prisma.semester.findUnique({
                where: {
                    id: semesterId,
                    isDeleted: false
                },
                select: { id: true, status: true, startDate: true },
            });
            if (!semester) {
                return {
                    success: false,
                    status: HTTP_STATUS.NOT_FOUND,
                    message: "Học kỳ không tồn tại.",
                };
            }
            if (semester.status === "ACTIVE" || semester.status === "COMPLETE") {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: "Không thể tạo nhóm trong học kỳ đang hoạt động.",
                };
            }
            if (semester.status !== "UPCOMING") {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: "Chỉ có thể tạo nhóm trước khi học kỳ bắt đầu.",
                };
            }

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
                where: { studentId: leader.id, semesterId },
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
                where: { studentId: leader.id, group: { semesterId } },
            });
            if (existingMembership) {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: "Sinh viên đã là thành viên của một nhóm trong học kỳ này.",
                };
            }

            // 5. Tạo mã nhóm dựa trên thông tin học kỳ: sử dụng startDate của học kỳ để lấy năm
            // Lấy tên chuyên ngành từ leader.major.name (đã được trim)
            const majorName = (leader.major.name || "").trim();
            // Gọi hàm generateUniqueGroupCode: truyền tên chuyên ngành, semesterId và startDate của học kỳ
            const groupCode = await this.generateUniqueGroupCode(majorName, semesterId, new Date(semester.startDate));

            // 6. Lấy số lượng thành viên tối đa và thông tin role "leader"
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
                    semesterId,
                    status: "ACTIVE",
                    createdBy: leaderId,
                    maxMembers,
                    isAutoCreated: false,
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
            // Kiểm tra quyền của người mời
            const userRoles = inviter.roles.map((r) => r.role.name.toLowerCase());
            if (!userRoles.includes("admin") && !userRoles.includes("leader") && !userRoles.includes("academic_officer")) {
                const inviterStudent = await prisma.student.findFirst({ where: { userId: invitedById } });

                // Truy vấn roleId của "leader"
                const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
                if (!leaderRole) throw new Error("Vai trò 'leader' không tồn tại.");

                const isLeader = await prisma.groupMember.findFirst({
                    where: {
                        groupId: groupId || undefined,
                        studentId: inviterStudent?.id,
                        roleId: leaderRole.id, // Sử dụng roleId thay vì role
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
                data: {
                    groupId: group.id,
                    studentId: invitedStudent.id,
                    status: "PENDING",
                    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // hết hạn sau 2 giờ
                    //expiresAt: new Date(Date.now() + 15 * 60 * 1000)hết hạn sau 15phut

                },
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
                message: "Lỗi hệ thống khi mời thành viên.",
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
            data: { status: response, respondedAt: new Date() },
        });

        if (response === "ACCEPTED") {
            // Truy vấn roleId của "member"
            const memberRole = await prisma.role.findUnique({ where: { name: "member" } });
            if (!memberRole) throw new Error("Vai trò 'member' không tồn tại.");

            await prisma.groupMember.create({
                data: {
                    groupId: invitation.groupId,
                    studentId: student.id,
                    roleId: memberRole.id, // Sử dụng roleId thay vì role
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
            data: { status: "ACCEPTED", respondedAt: new Date() },
        });

        // Thêm vào group
        // Truy vấn roleId cho "member"
        const memberRole = await prisma.role.findUnique({ where: { name: "member" } });
        if (!memberRole) throw new Error("Vai trò 'member' không tồn tại.");

        // Thay đổi trong forceAcceptInvitation
        await prisma.groupMember.create({
            data: {
                groupId: invitation.groupId,
                studentId: invitation.studentId,
                roleId: memberRole.id, // Sử dụng roleId
                status: "ACTIVE",
            },
        });
        return { message: "Lời mời đã được chấp nhận." };
    }

    // 5) getGroupsBySemester
    async getGroupsBySemester(semesterId: string, userId: string) {
        // Kiểm tra user
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { roles: { include: { role: true } } },
        });
        if (!user) throw new Error("Người dùng không tồn tại.");

        const userRoles = user.roles.map((r) => r.role.name.toLowerCase());
        //  console.log(`User ID: ${userId}, Roles: ${JSON.stringify(userRoles)}`);

        // Base query: luôn bao gồm members và mentors
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
        };

        // Vai trò quản lý: trả về tất cả nhóm trong kỳ
        if (
            userRoles.includes("graduation_thesis_manager") ||
            userRoles.includes("academic_officer") ||
            userRoles.includes("examination_officer")
        ) {
            //  console.log("Fetching all groups for manager role...");
            return prisma.group.findMany({
                where: { semesterId },
                include: baseInclude,
            });
        }

        // Vai trò sinh viên: chỉ trả về nhóm của sinh viên
        if (userRoles.includes("student")) {
            console.log("Fetching groups for student role...");
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
                include: baseInclude,
            });
        }

        // Vai trò mentor: chỉ trả về nhóm mà mentor hướng dẫn
        if (
            userRoles.includes("lecturer") ||
            userRoles.includes("mentor_main") ||
            userRoles.includes("mentor_sub")
        ) {
            //    console.log("Fetching groups for mentor role...");
            const mentorGroupIds = (
                await prisma.groupMentor.findMany({
                    where: { mentorId: userId },
                    select: { groupId: true },
                })
            ).map((gm) => gm.groupId);

            console.log(`Mentor Group IDs: ${JSON.stringify(mentorGroupIds)}`);

            if (mentorGroupIds.length === 0) {
                console.log("No groups found for this mentor.");
                return [];
            }

            return prisma.group.findMany({
                where: {
                    semesterId,
                    id: { in: mentorGroupIds },
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
    // Hàm tạo mã nhóm duy nhất theo học kỳ và tên ngành
    private async generateUniqueGroupCode(
        professionName: string,
        semesterId: string,
        semesterStartDate: Date
    ): Promise<string> {
        // Lấy 2 chữ số cuối của năm từ startDate của học kỳ
        const yearSuffix = semesterStartDate.getFullYear().toString().slice(-2);
        // Tạo mã chuyên ngành: nếu tên chuyên ngành là "Software Engineering" => "SE", "Artificial Intelligence" => "AI", ngược lại lấy 2 ký tự đầu của tên chuyên ngành
        let majorCode: string;
        if (professionName === "Software Engineering") {
            majorCode = "SE";
        } else if (professionName === "Artificial Intelligence") {
            majorCode = "AI";
        } else {
            majorCode = professionName.slice(0, 2).toUpperCase();
        }
        // Xây dựng tiền tố cho mã nhóm
        const groupCodePrefix = `G${yearSuffix}${majorCode}`;

        // Tính số thứ tự dựa trên số nhóm đã có trong học kỳ với tiền tố này
        const count = await prisma.group.count({
            where: {
                semesterId,
                groupCode: { startsWith: groupCodePrefix },
            },
        });
        let sequenceNumber = (count + 1).toString().padStart(3, "0");
        let groupCode = groupCodePrefix + sequenceNumber;

        // Kiểm tra xem mã nhóm đã tồn tại trong học kỳ chưa (sử dụng composite key)
        let existingGroup = await prisma.group.findUnique({
            where: { semesterId_groupCode: { semesterId, groupCode } },
        });
        if (existingGroup) {
            let seq = count + 1;
            while (true) {
                seq++;
                sequenceNumber = seq.toString().padStart(3, "0");
                const newGroupCode = groupCodePrefix + sequenceNumber;
                const checkGroup = await prisma.group.findUnique({
                    where: { semesterId_groupCode: { semesterId, groupCode: newGroupCode } },
                });
                if (!checkGroup) {
                    groupCode = newGroupCode;
                    break;
                }
            }
        }
        return groupCode;
    }

    // 7) randomizeGroups
    async randomizeGroups(semesterId: string, createdBy: string): Promise<any> {
        // 1. Kiểm tra quyền của người tạo
        const user = await prisma.user.findUnique({
            where: { id: createdBy },
            include: { roles: { include: { role: true } } },
        });
        if (!user) {
            console.error(`ERROR: Không tìm thấy user - createdBy=${createdBy}`);
            throw new Error("Người dùng không tồn tại.");
        }
        const userRoles = user.roles.map((r) => r.role.name.toLowerCase());
        const isAuthorized =
            userRoles.includes("admin") ||
            userRoles.includes("graduation_thesis_manager") ||
            userRoles.includes("academic_officer");
        if (!isAuthorized) {
            console.error(`Người dùng không có quyền random nhóm - createdBy=${createdBy}`);
            throw new Error("Bạn không có quyền thực hiện random nhóm.");
        }

        // 2. Lấy danh sách sinh viên đủ điều kiện nhưng chưa có nhóm
        const students = await prisma.student.findMany({
            where: {
                semesterStudents: { some: { semesterId, qualificationStatus: "qualified" } },
                groupMembers: { none: { group: { semesterId } } },
            },
            include: {
                user: { select: { programming_language: true, id: true } },
                major: true,
            },
        });
        if (students.length === 0) {
            return { message: "Không có sinh viên nào đủ điều kiện để tạo nhóm." };
        }

        // 3. Gom sinh viên theo ngành (dựa theo major.name)
        const groupedByProfession: { [profName: string]: typeof students } = {};
        for (const st of students) {
            const profName = st.major?.name || "Unknown";
            if (!groupedByProfession[profName]) {
                groupedByProfession[profName] = [];
            }
            groupedByProfession[profName].push(st);
        }

        const createdGroups = [];
        const groupSize = 5,
            minGroupSize = 4;

        // Hàm tiện ích: pop phần tử cuối mảng
        const popOne = (arr: any[]) => (arr.length === 0 ? null : arr.pop());

        // 4. Random nhóm theo từng ngành
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

                // Lấy 1 BE và 1 FE nếu có
                const pickBE = popOne(beStudents);
                if (pickBE) groupMembers.push(pickBE);
                const pickFE = popOne(feStudents);
                if (pickFE) groupMembers.push(pickFE);
                // Lấy 1 FS nếu có
                const pickFS = popOne(fsStudents);
                if (pickFS) groupMembers.push(pickFS);

                // Thêm thành viên cho đến khi đủ groupSize (5)
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

                // Nếu nhóm có số thành viên nhỏ hơn minGroupSize, bỏ qua
                if (groupMembers.length < minGroupSize) break;

                // Random chọn leader: hoán đổi phần tử đầu tiên với phần tử được chọn ngẫu nhiên
                const leaderIndex = Math.floor(Math.random() * groupMembers.length);
                const leaderInGroup = groupMembers[leaderIndex];
                groupMembers[leaderIndex] = groupMembers[0];
                groupMembers[0] = leaderInGroup;

                // 5. Tạo groupCode duy nhất cho nhóm này
                const semester = await prisma.semester.findUnique({
                    where: {
                        id: semesterId,
                        isDeleted: false
                    },
                    select: { startDate: true },
                });
                if (!semester || !semester.startDate) {
                    throw new Error("Học kỳ không tồn tại hoặc không có ngày bắt đầu.");
                }
                const groupCode = await this.generateUniqueGroupCode(professionName, semesterId, semester.startDate);

                // Lấy thông tin role cho "leader" và "member"
                const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
                const memberRole = await prisma.role.findUnique({ where: { name: "member" } });
                if (!leaderRole || !memberRole)
                    throw new Error("Vai trò 'leader' hoặc 'member' không tồn tại.");

                // 6. Tạo nhóm mới trong database
                const newGroup = await prisma.group.create({
                    data: {
                        groupCode,
                        semesterId, // Đảm bảo khớp với học kỳ hiện tại
                        status: "ACTIVE",
                        createdBy,
                        maxMembers: groupSize,
                        isAutoCreated: true,
                        members: {
                            create: groupMembers.map((member, idx) => ({
                                student: { connect: { id: member.id } },
                                role: { connect: { id: idx === 0 ? leaderRole.id : memberRole.id } },
                                status: "ACTIVE",
                            })),
                        },
                    },
                    include: { members: { include: { role: true } } },

                });

                // 7. Format lại dữ liệu trả về: chỉ trả về studentId, role (role.name) và status cho mỗi thành viên
                const formattedGroup = {
                    ...newGroup,
                    members: newGroup.members.map((member) => ({
                        studentId: member.studentId,
                        role: member.role.name,
                        status: member.status,
                    })),
                };

                createdGroups.push(formattedGroup);
            }
        }

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
                description: "Thử xóa nhóm nhưng không có quyền (chỉ leader hoặc academic_officer)",
                severity: "WARNING",
                ipAddress: ipAddress || "unknown",
                metadata: { userRoles },
              },
            });
            throw new Error("Bạn không có quyền xóa nhóm (chỉ leader hoặc graduation_thesis_manager/academic_officer).");
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
            const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
            if (!leaderRole) throw new Error("Vai trò 'leader' không tồn tại.");
            const leader = await prisma.groupMember.findFirst({
                where: { groupId, studentId: student.id, roleId: leaderRole.id, isActive: true },
            });
            if (leader) isLeader = true;
        }

        // 3️ Nếu không phải admin hoặc leader -> từ chối
        if (!isAdmin && !isLeader) {
            console.error(`Người dùng không có quyền xem danh sách lời mời - userId=${userId}`);
            throw new Error("Bạn không có quyền xem danh sách lời mời (chỉ leader hoặc admin).");
        }

        // 4️ Lấy danh sách lời mời
        const invitations = await prisma.groupInvitation.findMany({
            where: { groupId },
        });

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
            const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
            if (!leaderRole) throw new Error("Vai trò 'leader' không tồn tại.");
            const leader = await prisma.groupMember.findFirst({
                where: { groupId, studentId: student.id, roleId: leaderRole.id, isActive: true },
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
    async updateMentor(groupIdOrCode: string, oldMentorIdOrEmail: string, newMentorIdOrEmail: string, newMentorRole: string, userId: string, semesterId: string) {
        //  console.log(" Debug Inputs:", { groupIdOrCode, oldMentorIdOrEmail, newMentorIdOrEmail, newMentorRole, semesterId });

        if (!groupIdOrCode || !oldMentorIdOrEmail || !newMentorIdOrEmail || !newMentorRole) {
            throw new Error("Cần cung cấp đầy đủ thông tin.");
        }

        if (!["mentor_main", "mentor_sub"].includes(newMentorRole)) {
            throw new Error("Vai trò mới phải là 'mentor_main' hoặc 'mentor_sub'.");
        }

        // 🔍 Tìm nhóm bằng ID hoặc groupCode
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

        // 2️ Kiểm tra xem user có phải leader của nhóm không
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

        // 3️ Nếu không phải admin hoặc leader -> từ chối
        if (!isAdmin && !isLeader) {
            console.error(`Người dùng không có quyền xem thành viên nhóm - userId=${userId}`);
            throw new Error("Bạn không có quyền xem thành viên nhóm (chỉ leader hoặc graduation_thesis_manager ,academic_officer , student ).");
        }

        // 4️ Lấy danh sách thành viên nhóm
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

        // 4️ Mở khóa nhóm
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
            // **1. Kiểm tra thông tin bắt buộc**
            if (!leaderEmail) {
                return { success: false, status: 400, message: "Email trưởng nhóm là bắt buộc." };
            }
            if (!semesterId) {
                return { success: false, status: 400, message: "Học kỳ là bắt buộc." };
            }
            if (!createdBy) {
                return { success: false, status: 400, message: "Thông tin người tạo nhóm không hợp lệ." };
            }

            // **2. Kiểm tra học kỳ (chỉ cần tồn tại, không quan tâm trạng thái)**
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
            // Không kiểm tra semester.status, cho phép tạo nhóm ở mọi trạng thái học kỳ

            // **3. Tìm trưởng nhóm và thông tin chuyên ngành**
            const leader = await prisma.student.findFirst({
                where: { user: { email: leaderEmail } },
                include: { user: true, major: true },
            });
            if (!leader || !leader.major) {
                return { success: false, status: 404, message: "Trưởng nhóm không tồn tại hoặc không có chuyên ngành." };
            }
            const majorName = leader.major.name;

            // **4. Kiểm tra sinh viên có thuộc học kỳ không**
            const studentSemester = await prisma.semesterStudent.findFirst({
                where: { studentId: leader.id, semesterId },
            });
            if (!studentSemester) {
                return { success: false, status: 400, message: "Trưởng nhóm không thuộc học kỳ này." };
            }

            // **5. Kiểm tra trạng thái đủ điều kiện**
            if (studentSemester.qualificationStatus.trim().toLowerCase() !== "qualified") {
                return {
                    success: false,
                    status: 400,
                    message: `Trưởng nhóm không đủ điều kiện tham gia nhóm. Trạng thái hiện tại: ${studentSemester.qualificationStatus}`
                };
            }

            // **6. Kiểm tra trưởng nhóm đã thuộc nhóm nào chưa**
            const existingMember = await prisma.groupMember.findFirst({
                where: { studentId: leader.id, group: { semesterId } },
            });
            if (existingMember) {
                return { success: false, status: 400, message: "Trưởng nhóm đã thuộc một nhóm trong học kỳ này." };
            }

            // **7. Tạo mã nhóm duy nhất**
            const groupCode = await this.generateUniqueGroupCode(majorName, semesterId, semester.startDate);
            if (!groupCode) {
                return { success: false, status: 500, message: "Không thể tạo mã nhóm." };
            }

            // **8. Lấy số lượng thành viên tối đa từ SystemConfigService**
            const maxMembers = await systemConfigService.getMaxGroupMembers();
            if (maxMembers <= 0) {
                return { success: false, status: 500, message: "Số lượng thành viên tối đa không hợp lệ." };
            }

            // **9. Tạo nhóm mới**
            const newGroup = await prisma.group.create({
                data: {
                    groupCode,
                    semesterId,
                    status: "ACTIVE",
                    createdBy,
                    maxMembers,
                },
            });

            // **10. Thêm trưởng nhóm vào nhóm với vai trò "leader"**
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

            // **11. Trả về kết quả thành công**
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
            // 1. Kiểm tra thông tin nhóm (dùng groupId hoặc groupCode)
            const group = await prisma.group.findFirst({
                where: {
                    OR: [
                        ...(groupIdentifier.groupId ? [{ id: groupIdentifier.groupId }] : []),
                        ...(groupIdentifier.groupCode ? [{ groupCode: groupIdentifier.groupCode }] : []),
                    ],
                },
                include: {
                    semester: true, // Lấy thông tin học kỳ
                },
            });
            if (!group) {
                throw new Error("Nhóm không tồn tại.");
            }

            // 2. Xác định trạng thái thực tế của học kỳ
            const currentDate = new Date();
            const startDate = new Date(group.semester.startDate);
            // Nếu endDate không có, sử dụng giá trị cực đại của Date
            const endDate = group.semester.endDate ? new Date(group.semester.endDate) : new Date(8640000000000000);
            let effectiveStatus = group.semester.status;
            if (currentDate < startDate) effectiveStatus = "UPCOMING";
            else if (currentDate >= startDate && currentDate <= endDate) effectiveStatus = "ACTIVE";
            else if (currentDate > endDate) effectiveStatus = "COMPLETE";

            // 3. Không cho phép thay đổi nếu học kỳ COMPLETE
            if (effectiveStatus === "COMPLETE") {
                throw new Error("Không thể thay đổi trạng thái thành viên trong học kỳ đã hoàn thành.");
            }

            // 4. Kiểm tra mentor có được gán trong nhóm không
            const mentorInGroup = await prisma.groupMentor.findFirst({
                where: { groupId: group.id, mentorId },
            });
            if (!mentorInGroup) {
                throw new Error("Bạn không phải là mentor của nhóm này.");
            }

            // 5. Kiểm tra thành viên trong nhóm (dùng memberId hoặc memberEmail)
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
                    role: true, // Lấy thông tin vai trò của thành viên
                    student: {
                        include: {
                            user: true, // Lấy thông tin người dùng để truy cập email
                        },
                    },
                },
            });
            if (!member) {
                throw new Error("Thành viên không tồn tại trong nhóm.");
            }

            // 6. Không cho phép thay đổi trạng thái của leader
            if (member.role.name.toLowerCase() === "leader") {
                throw new Error("Không thể thay đổi trạng thái của trưởng nhóm. Hãy thay đổi leader trước.");
            }

            // 7. Nếu trạng thái hiện tại của thành viên đã bằng newStatus thì trả về thông báo không cần thay đổi
            if (member.status === newStatus) {
                return {
                    success: true,
                    status: HTTP_STATUS.OK,
                    message: `Thành viên đã ở trạng thái ${newStatus}. Không cần thay đổi.`,
                };
            }

            // 8. Cập nhật trạng thái thành viên, đồng thời trả về các trường cần thiết (bao gồm isActive)
            const updatedMember = await prisma.groupMember.update({
                where: { id: member.id },
                data: { status: newStatus },
                select: {
                    studentId: true,
                    status: true,
                    isActive: true, // Lấy trường isActive
                },
            });

            // 9. Trả về kết quả cập nhật
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
                })),
            }));

            return formattedGroups;
        } catch (error) {
            console.error("Lỗi trong getMyGroups:", error);
            throw error;
        }
    }
}