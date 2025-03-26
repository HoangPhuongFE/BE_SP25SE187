import { Prisma, PrismaClient } from '@prisma/client';
import HTTP_STATUS from '../constants/httpStatus';
import COUNCIL_MESSAGE from '../constants/message';
import { SystemConfigService } from './system.config.service';

const prisma = new PrismaClient();
const systemConfigService = new SystemConfigService();

export class CouncilDefenseService {
    [x: string]: any;
    // Tạo hội đồng bảo vệ
    async createDefenseCouncil(data: {
        name: string;
        semesterId: string;
        submissionPeriodId?: string;
        createdBy: string;
        startDate: Date;
        endDate: Date;
        status?: string;
        defenseRound?: number;
    }) {
        try {
            // Kiểm tra createdBy (lấy từ token qua controller)
            if (!data.createdBy) {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: 'Không xác định được người tạo hội đồng!',
                };
            }

            const creator = await prisma.user.findUnique({
                where: { id: data.createdBy },
                include: { roles: { include: { role: true } } },
            });
            if (!creator) {
                return { success: false, status: HTTP_STATUS.NOT_FOUND, message: `Không tìm thấy người dùng với ID: ${data.createdBy}!` };
            }

            const creatorRoles = creator.roles.map(r => r.role.name.toLowerCase());
            if (creatorRoles.includes("academic_officer") || creatorRoles.includes("admin")) {
                return { success: false, status: HTTP_STATUS.FORBIDDEN, message: "Academic officer và admin không được phép tạo hội đồng." };
            }

            const semester = await prisma.semester.findUnique({ where: { id: data.semesterId } });
            if (!semester) {
                return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Học kỳ không tồn tại!" };
            }

            if (data.submissionPeriodId) {
                const submissionPeriod = await prisma.submissionPeriod.findUnique({ where: { id: data.submissionPeriodId } });
                if (!submissionPeriod) {
                    return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Đợt xét duyệt không tồn tại!" };
                }
            }

            if (data.startDate >= data.endDate) {
                return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: "Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc." };
            }

            const now = new Date();
            let computedStatus = data.status || "ACTIVE";
            if (now < data.startDate) computedStatus = "UPCOMING";
            else if (now >= data.startDate && now <= data.endDate) computedStatus = "ACTIVE";
            else computedStatus = "COMPLETE";

            const prefix = `DEFENSE-${data.defenseRound || 1}-${semester.code}`;
            const count = await prisma.council.count({ where: { code: { startsWith: prefix } } });
            const sequenceNumber = (count + 1).toString().padStart(3, "0");
            const councilCode = `${prefix}-${sequenceNumber}`;

            const newCouncil = await prisma.council.create({
                data: {
                    name: data.name,
                    semesterId: data.semesterId,
                    submissionPeriodId: data.submissionPeriodId || null,
                    councilStartDate: data.startDate,
                    councilEndDate: data.endDate,
                    status: computedStatus,
                    type: "DEFENSE",
                    round: data.defenseRound || 1,
                    createdDate: new Date(),
                    code: councilCode,
                },
            });

            return { success: true, status: HTTP_STATUS.CREATED, message: "Tạo hội đồng bảo vệ thành công!", data: newCouncil };
        } catch (error: any) {
            console.error("Lỗi khi tạo hội đồng bảo vệ:", error);
            return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống khi tạo hội đồng bảo vệ." };
        }
    }

    // Thêm thành viên vào hội đồng bảo vệ
    async addMemberToCouncil(councilId: string, data: { email: string; role: string; addedBy: string }) {
        try {
            const council = await prisma.council.findUnique({ where: { id: councilId, type: "DEFENSE" } });
            if (!council) {
                return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Hội đồng bảo vệ không tồn tại!" };
            }

            const user = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
            if (!user) {
                return { success: false, status: HTTP_STATUS.NOT_FOUND, message: `Không tìm thấy người dùng với email: ${data.email}` };
            }

            const role = await prisma.role.findUnique({ where: { name: data.role } });
            if (!role) {
                return { success: false, status: HTTP_STATUS.NOT_FOUND, message: `Vai trò ${data.role} không tồn tại!` };
            }

            // Kiểm tra thành viên đã tồn tại
            const existingMember = await prisma.councilMember.findFirst({
                where: { councilId, userId: user.id, isDeleted: false },
            });
            if (existingMember) {
                return { success: false, status: HTTP_STATUS.CONFLICT, message: "Người dùng đã là thành viên của hội đồng!" };
            }

            // Lấy cấu hình từ SystemConfigService
            const minChairman = await systemConfigService.getMinDefenseChairman(); // 1
            const maxChairman = await systemConfigService.getMaxDefenseChairman(); // 1
            const minSecretary = await systemConfigService.getMinDefenseSecretary(); // 1
            const maxSecretary = await systemConfigService.getMaxDefenseSecretary(); // 1
            const minReviewers = await systemConfigService.getMinDefenseReviewers(); // 3
            const maxReviewers = await systemConfigService.getMaxDefenseReviewers(); // 3
            const maxDefenseMembers = await systemConfigService.getMaxDefenseMembers(); // 5 (tổng tối đa)

            // Đếm số lượng hiện tại theo vai trò
            const currentMembers = await prisma.councilMember.findMany({
                where: { councilId, isDeleted: false },
                include: { role: true },
            });

            const chairmanCount = currentMembers.filter(m => m.role.name === "council_chairman").length;
            const secretaryCount = currentMembers.filter(m => m.role.name === "council_secretary").length;
            const reviewerCount = currentMembers.filter(m => m.role.name === "council_member").length;
            const totalMemberCount = currentMembers.length;

            // Kiểm tra giới hạn tối đa
            if (data.role === "council_chairman" && chairmanCount >= maxChairman) {
                return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: `Hội đồng đã có đủ ${maxChairman} chủ tịch!` };
            }
            if (data.role === "council_secretary" && secretaryCount >= maxSecretary) {
                return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: `Hội đồng đã có đủ ${maxSecretary} thư ký!` };
            }
            if (data.role === "council_member" && reviewerCount >= maxReviewers) {
                return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: `Hội đồng đã có đủ ${maxReviewers} thành viên thường!` };
            }
            if (totalMemberCount >= maxDefenseMembers) {
                return { success: false, status: HTTP_STATUS.BAD_REQUEST, message: `Số lượng thành viên đã đạt tối đa (${maxDefenseMembers})!` };
            }

            // Thêm thành viên mới
            const newMember = await prisma.councilMember.create({
                data: {
                    councilId,
                    userId: user.id,
                    roleId: role.id,
                    assignedAt: new Date(),
                    status: "ACTIVE",
                    semesterId: council.semesterId || '',
                },
            });

            // Kiểm tra yêu cầu tối thiểu khi đạt tổng số thành viên tối đa
            const updatedMembers = await prisma.councilMember.findMany({
                where: { councilId, isDeleted: false },
                include: { role: true },
            });
            const updatedTotalCount = updatedMembers.length;
            const updatedChairmanCount = updatedMembers.filter(m => m.role.name === "council_chairman").length;
            const updatedSecretaryCount = updatedMembers.filter(m => m.role.name === "council_secretary").length;
            const updatedReviewerCount = updatedMembers.filter(m => m.role.name === "council_member").length;

            if (updatedTotalCount === maxDefenseMembers) {
                if (updatedChairmanCount !== minChairman || updatedSecretaryCount !== minSecretary || updatedReviewerCount !== minReviewers) {
                    // Nếu không đủ thành phần, xóa thành viên vừa thêm và báo lỗi
                    await prisma.councilMember.delete({ where: { id: newMember.id } });
                    return {
                        success: false,
                        status: HTTP_STATUS.BAD_REQUEST,
                        message: `Hội đồng phải có đúng ${minChairman} chủ tịch, ${minSecretary} thư ký, và ${minReviewers} thành viên thường khi đạt ${maxDefenseMembers} người!`,
                    };
                }
            }

            return { success: true, status: HTTP_STATUS.CREATED, message: "Thêm thành viên thành công!", data: newMember };
        } catch (error) {
            console.error("Lỗi khi thêm thành viên:", error);
            return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
        }
    }

    // Thêm nhóm vào hội đồng bảo vệ (Tạo lịch bảo vệ)
    async createDefenseSchedule(data: {
        councilId: string;
        groups: { groupId: string; defenseTime: Date }[];
        room: string;
        createdBy: string;
        defenseRound: number;
    }) {
        try {
            // Kiểm tra hội đồng tồn tại
            const council = await prisma.council.findUnique({
                where: { id: data.councilId, type: "DEFENSE" },
            });
            if (!council) {
                return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Hội đồng bảo vệ không tồn tại!" };
            }

            // Kiểm tra số lượng nhóm tối đa
            const maxTopicsPerSchedule = await systemConfigService.getMaxTopicsPerCouncilSchedule(); // Mặc định 4
            if (data.groups.length > maxTopicsPerSchedule) {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: `Số lượng nhóm vượt quá giới hạn (${maxTopicsPerSchedule}) trong một lịch bảo vệ!`,
                };
            }

            // Kiểm tra trùng thời gian
            const existingSchedules = await prisma.defenseSchedule.findMany({
                where: { councilId: data.councilId, isDeleted: false },
            });
            for (const group of data.groups) {
                const overlappingSchedule = existingSchedules.find(
                    s => Math.abs(s.defenseTime.getTime() - group.defenseTime.getTime()) < 1000 // 1 giây
                );
                if (overlappingSchedule) {
                    return {
                        success: false,
                        status: HTTP_STATUS.CONFLICT,
                        message: `Thời gian bảo vệ ${group.defenseTime.toISOString()} trùng với lịch hiện có!`,
                    };
                }
            }

            // Lấy danh sách nhóm và kiểm tra phân công đề tài
            const groupIds = data.groups.map(g => g.groupId);
            const topicAssignments = await prisma.topicAssignment.findMany({
                where: { groupId: { in: groupIds }, defendStatus: "CONFIRMED", defenseRound: data.defenseRound.toString() },
                include: {
                    group: { include: { members: true, mentors: { include: { mentor: true } } } },
                },
            });

            const invalidGroups = groupIds.filter(gid => !topicAssignments.some(ta => ta.groupId === gid));
            if (invalidGroups.length > 0) {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: `Các nhóm chưa được phân công đề tài hoặc không hợp lệ: ${invalidGroups.join(", ")}!`,
                };
            }

            // Kiểm tra xung đột mentor và thành viên hội đồng
            const councilMembers = await prisma.councilMember.findMany({
                where: { councilId: data.councilId, isDeleted: false },
            });
            const councilMemberIds = councilMembers.map(m => m.userId);
            for (const assignment of topicAssignments) {
                const groupMentors = assignment.group.mentors.filter(m => !m.isDeleted);
                const conflictingMentor = groupMentors.find(m => councilMemberIds.includes(m.mentorId));
                if (conflictingMentor) {
                    return {
                        success: false,
                        status: HTTP_STATUS.BAD_REQUEST,
                        message: `Mentor ${conflictingMentor.mentor.fullName} (ID: ${conflictingMentor.mentorId}) không được là thành viên hội đồng của nhóm ${assignment.groupId}!`,
                    };
                }
            }

            // Tạo lịch bảo vệ và kết quả thành viên trong transaction
            const newSchedules = await prisma.$transaction(async (tx) => {
                const schedules = [];
                for (const group of data.groups) {
                    const assignment = topicAssignments.find(ta => ta.groupId === group.groupId);
                    if (!assignment) continue; // Đã kiểm tra trước, nhưng giữ để an toàn

                    const schedule = await tx.defenseSchedule.create({
                        data: {
                            councilId: data.councilId,
                            groupId: group.groupId,
                            defenseTime: group.defenseTime,
                            room: data.room,
                            defenseRound: data.defenseRound,
                            status: "PENDING",
                        },
                    });

                    const memberResults = [];
                    for (const member of assignment.group.members) {
                        if (!member.studentId) continue; // Bỏ qua nếu không có studentId
                        const result = await tx.defenseMemberResult.create({
                            data: {
                                defenseScheduleId: schedule.id,
                                studentId: member.studentId,
                                result: "PENDING",
                            },
                        });
                        memberResults.push(result);
                    }

                    schedules.push({ schedule, memberResults });
                }
                return schedules;
            });

            return {
                success: true,
                status: HTTP_STATUS.CREATED,
                message: "Tạo lịch bảo vệ thành công!",
                data: newSchedules.map(s => ({
                    schedule: s.schedule,
                    memberResults: s.memberResults,
                })),
            };
        } catch (error) {
            console.error("Lỗi khi tạo lịch bảo vệ:", error);
            return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
        }
    }

    // Xóa hội đồng bảo vệ
    async deleteDefenseCouncil(councilId: string, userId: string, ipAddress?: string) {
        try {
            const council = await prisma.council.findUnique({ where: { id: councilId, type: "DEFENSE", isDeleted: false } });
            if (!council) {
                return { success: false, status: HTTP_STATUS.NOT_FOUND, message: COUNCIL_MESSAGE.COUNCIL_NOT_FOUND };
            }

            const updatedCouncil = await prisma.$transaction(async (tx) => {
                await tx.defenseSchedule.updateMany({ where: { councilId, isDeleted: false }, data: { isDeleted: true } });
                await tx.defenseMemberResult.updateMany({ where: { defenseSchedule: { councilId }, isDeleted: false }, data: { isDeleted: true } });
                await tx.council.update({ where: { id: councilId }, data: { isDeleted: true } });
                return await tx.council.findUnique({ where: { id: councilId } });
            });

            return { success: true, status: HTTP_STATUS.OK, message: "Xóa hội đồng bảo vệ thành công!", data: updatedCouncil };
        } catch (error) {
            console.error("Lỗi khi xóa hội đồng bảo vệ:", error);
            return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
        }
    }

    // Cập nhật hội đồng bảo vệ
    async updateDefenseCouncil(
        councilId: string,
        data: {
          name?: string;
          code?: string;
          round?: number;
          status?: string;
          councilStartDate?: Date;
          councilEndDate?: Date;
          topicAssId?: string;
          semesterId?: string;
          isActive?: boolean;
          submissionPeriodId?: string;
        }
      ) {
        try {
          // **Bước 1: Kiểm tra hội đồng có tồn tại không**
          const existingCouncil = await prisma.council.findUnique({
            where: {
              id: councilId,
              type: "DEFENSE", // Phân biệt hội đồng bảo vệ
              isDeleted: false,
            },
          });
      
          if (!existingCouncil) {
            return {
              success: false,
              status: HTTP_STATUS.NOT_FOUND,
              message: "Hội đồng bảo vệ không tồn tại!",
            };
          }
      
          // **Bước 2: Sao chép dữ liệu để xử lý**
          let updateData: any = { ...data };
      
          // **Bước 3: Validation**
          if (data.code && data.code !== existingCouncil.code) {
            const codeExists = await prisma.council.findUnique({
              where: { code: data.code },
            });
            if (codeExists) {
              return {
                success: false,
                status: HTTP_STATUS.CONFLICT,
                message: "Mã hội đồng đã tồn tại!",
              };
            }
          }
      
          if (data.councilStartDate && data.councilEndDate) {
            if (data.councilStartDate >= data.councilEndDate) {
              return {
                success: false,
                status: HTTP_STATUS.BAD_REQUEST,
                message: "Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc!",
              };
            }
          }
      
          if (data.round !== undefined && (!Number.isInteger(data.round) || data.round <= 0)) {
            return {
              success: false,
              status: HTTP_STATUS.BAD_REQUEST,
              message: "Vòng bảo vệ phải là số nguyên dương!",
            };
          }
      
          const validStatuses = ["UPCOMING", "ACTIVE", "COMPLETE"];
          if (data.status && !validStatuses.includes(data.status)) {
            return {
              success: false,
              status: HTTP_STATUS.BAD_REQUEST,
              message: "Trạng thái không hợp lệ! Chỉ chấp nhận: UPCOMING, ACTIVE, COMPLETE.",
            };
          }
      
          // **Bước 4: Xử lý logic cho status**
          if (data.councilStartDate && data.councilEndDate) {
            const now = new Date();
            let computedStatus = data.status || "ACTIVE";
      
            if (now < data.councilStartDate) {
              computedStatus = "UPCOMING";
            } else if (now >= data.councilStartDate && now <= data.councilEndDate) {
              computedStatus = "ACTIVE";
            } else if (now > data.councilEndDate) {
              computedStatus = "COMPLETE";
            }
      
            updateData.status = computedStatus;
          } else if (data.status) {
            updateData.status = data.status;
          }
      
          // **Bước 5: Thực hiện cập nhật**
          const updatedCouncil = await prisma.council.update({
            where: { id: councilId },
            data: {
              code: updateData.code,
              name: updateData.name,
              round: updateData.round,
              status: updateData.status,
              councilStartDate: updateData.councilStartDate,
              councilEndDate: updateData.councilEndDate,
              topicAssId: updateData.topicAssId,
              semesterId: updateData.semesterId,
              isActive: updateData.isActive,
              submissionPeriodId: updateData.submissionPeriodId,
            },
          });
      
          return {
            success: true,
            status: HTTP_STATUS.OK,
            message: "Cập nhật hội đồng bảo vệ thành công!",
            data: updatedCouncil,
          };
        } catch (error) {
          console.error("Lỗi khi cập nhật hội đồng bảo vệ:", error);
      
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return {
              success: false,
              status: HTTP_STATUS.CONFLICT,
              message: "Mã hội đồng đã tồn tại!",
            };
          }
      
          return {
            success: false,
            status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
            message: "Lỗi hệ thống khi cập nhật hội đồng bảo vệ!",
          };
        }
      }
    // Lấy chi tiết hội đồng bảo vệ
    async getDefenseCouncilById(councilId: string) {
        try {
            const council = await prisma.council.findUnique({
                where: { id: councilId, type: "DEFENSE", isDeleted: false },
                include: {
                    members: {
                        include: {
                            user: { select: { id: true, fullName: true, email: true } },
                            role: { select: { id: true, name: true } },
                        },
                    },
                    semester: { select: { id: true, code: true, startDate: true, endDate: true, status: true } },
                    submissionPeriod: { select: { id: true, roundNumber: true, startDate: true, endDate: true, status: true } },
                    defenseSchedules: {
                        include: {
                            group: {
                                include: {
                                    members: {
                                        include: {
                                            student: { select: { id: true, studentCode: true, user: { select: { fullName: true, email: true } } } },
                                            role: { select: { id: true, name: true } },
                                        },
                                    },
                                    mentors: {
                                        include: {
                                            mentor: { select: { id: true, fullName: true, email: true } },
                                            role: { select: { id: true, name: true } },
                                        },
                                    },
                                    topicAssignments: {
                                        include: {
                                            topic: { select: { id: true, topicCode: true, name: true, status: true } },
                                        },
                                    },
                                },
                            },
                            memberResults: {
                                include: {
                                    student: { select: { id: true, studentCode: true, user: { select: { fullName: true } } } },
                                },
                            },
                            documents: {
                                where: { isDeleted: false },
                                select: { id: true, fileName: true, fileUrl: true, documentType: true, uploadedAt: true, uploadedBy: true },
                            },
                        },
                    },
                    documents: {
                        where: { isDeleted: false },
                        select: { id: true, fileName: true, fileUrl: true, documentType: true, uploadedAt: true, uploadedBy: true },
                    },
                },
            });

            if (!council) {
                return { success: false, status: HTTP_STATUS.NOT_FOUND, message: COUNCIL_MESSAGE.COUNCIL_NOT_FOUND };
            }

            return { success: true, status: HTTP_STATUS.OK, message: "Lấy chi tiết hội đồng thành công!", data: council };
        } catch (error) {
            console.error("Lỗi khi lấy chi tiết hội đồng bảo vệ:", error);
            return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
        }
    }

    // Lấy danh sách hội đồng bảo vệ
    async getDefenseCouncils(filter: {
        semesterId?: string;
        submissionPeriodId?: string;
        round?: number;
        user?: { userId: string; roles: { name: string; semesterId?: string | null }[] };
    }) {
        try {
            const { semesterId, submissionPeriodId, round, user } = filter;
            let whereClause: any = {
                type: "DEFENSE",
                isDeleted: false,
                ...(semesterId && { semesterId }),
                ...(submissionPeriodId && { submissionPeriodId }),
                ...(round !== undefined && { round }),
            };

            // Nếu user là lecturer và không có vai trò đặc biệt, chỉ lấy hội đồng mà user là thành viên
            if (user && user.roles.some(role => role.name === "lecturer") && !user.roles.some(role => ["examination_officer", "graduation_thesis_manager"].includes(role.name))) {
                whereClause = {
                    ...whereClause,
                    members: {
                        some: {
                            userId: user.userId,
                            isDeleted: false,
                        },
                    },
                };
            }

            const councils = await prisma.council.findMany({
                where: whereClause,
                include: {
                    members: {
                        include: {
                            user: { select: { id: true, fullName: true, email: true } },
                            role: { select: { id: true, name: true } },
                        },
                    },
                    semester: { select: { id: true, code: true, startDate: true, endDate: true } },
                    submissionPeriod: { select: { id: true, roundNumber: true, startDate: true, endDate: true } },
                },
            });

            return {
                success: true,
                status: HTTP_STATUS.OK,
                message: "Lấy danh sách hội đồng bảo vệ thành công!",
                data: councils,
            };
        } catch (error) {
            console.error("Lỗi khi lấy danh sách hội đồng bảo vệ:", error);
            return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
        }
    }

    // Mentor xem danh sách hội đồng bảo vệ
    async getDefenseScheduleForMentor(userId: string) {
        try {
            // Lấy danh sách nhóm mà user là mentor
            const mentorGroups = await prisma.groupMentor.findMany({
                where: { mentorId: userId, isDeleted: false },
                select: { groupId: true },
            });
            const groupIds = mentorGroups.map(gm => gm.groupId);

            if (groupIds.length === 0) {
                return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Bạn không phụ trách nhóm nào!" };
            }

            // Lấy lịch bảo vệ với tất cả thông tin liên quan
            const schedules = await prisma.defenseSchedule.findMany({
                where: { groupId: { in: groupIds }, isDeleted: false },
                include: {
                    council: {
                        include: {
                            members: {
                                include: {
                                    user: { select: { id: true, fullName: true, email: true } },
                                    role: { select: { id: true, name: true } },
                                },
                            },
                            semester: { select: { id: true, code: true, startDate: true, endDate: true, status: true } },
                            submissionPeriod: { select: { id: true, roundNumber: true, startDate: true, endDate: true, status: true } },
                        },
                    },
                    group: {
                        include: {
                            members: {
                                include: {
                                    student: { select: { id: true, studentCode: true, user: { select: { fullName: true, email: true } } } },
                                    role: { select: { id: true, name: true } },
                                },
                            },
                            mentors: {
                                include: {
                                    mentor: { select: { id: true, fullName: true, email: true } },
                                    role: { select: { id: true, name: true } },
                                },
                            },
                            topicAssignments: {
                                include: {
                                    topic: { select: { id: true, topicCode: true, name: true, status: true } },
                                },
                            },
                        },
                    },
                    memberResults: {
                        include: {
                            student: { select: { id: true, studentCode: true, user: { select: { fullName: true } } } },
                        },
                    },
                    documents: {
                        where: { documentType: "DEFENSE_REPORT", isDeleted: false },
                        select: { id: true, fileName: true, fileUrl: true, documentType: true, uploadedAt: true, uploadedBy: true },
                    },
                },
            });

            if (schedules.length === 0) {
                return { success: false, status: HTTP_STATUS.OK, message: "Hiện chưa có lịch bảo vệ nào cho nhóm bạn phụ trách!" };
            }

            return { success: true, status: HTTP_STATUS.OK, message: "Lấy lịch bảo vệ thành công!", data: schedules };
        } catch (error) {
            console.error("Lỗi khi lấy lịch bảo vệ:", error);
            return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
        }
    }
    // Student xem danh sách hội đồng bảo vệ
    async getDefenseScheduleForStudent(userId: string) {
        try {
            // 1. Tìm kỳ học đang hoạt động
            const activeSemester = await prisma.semester.findFirst({
                where: { status: "active", isDeleted: false },
                orderBy: { startDate: "desc" },
            });

            if (!activeSemester) {
                return {
                    success: false,
                    status: HTTP_STATUS.NOT_FOUND,
                    message: "Hiện tại không có học kỳ nào đang hoạt động!",
                };
            }

            // 2. Tìm thông tin sinh viên
            const student = await prisma.student.findFirst({
                where: { userId, isDeleted: false },
                select: { id: true },
            });

            if (!student) {
                return {
                    success: false,
                    status: HTTP_STATUS.NOT_FOUND,
                    message: "Không tìm thấy thông tin sinh viên!",
                };
            }

            // 3. Tìm nhóm trong kỳ học hiện tại
            const groupMember = await prisma.groupMember.findFirst({
                where: {
                    studentId: student.id,
                    isDeleted: false,
                    group: { semesterId: activeSemester.id, isDeleted: false },
                },
                include: { group: true },
            });

            if (!groupMember) {
                return {
                    success: false,
                    status: HTTP_STATUS.NOT_FOUND,
                    message: "Bạn hiện không thuộc nhóm nào trong kỳ hiện tại!",
                };
            }

            // 4. Tìm lịch bảo vệ
            const schedules = await prisma.defenseSchedule.findMany({
                where: { groupId: groupMember.groupId, isDeleted: false },
                include: {
                    council: {
                        include: {
                            members: {
                                include: {
                                    user: { select: { id: true, fullName: true, email: true } },
                                    role: { select: { id: true, name: true } },
                                },
                            },
                            semester: { select: { id: true, code: true, startDate: true, endDate: true, status: true } },
                            submissionPeriod: { select: { id: true, roundNumber: true, startDate: true, endDate: true, status: true } },
                        },
                    },
                    group: {
                        include: {
                            members: {
                                include: {
                                    student: { select: { id: true, studentCode: true, user: { select: { fullName: true, email: true } } } },
                                    role: { select: { id: true, name: true } },
                                },
                            },
                            mentors: {
                                include: {
                                    mentor: { select: { id: true, fullName: true, email: true } },
                                    role: { select: { id: true, name: true } },
                                },
                            },
                            topicAssignments: {
                                include: {
                                    topic: { select: { id: true, topicCode: true, name: true, status: true } },
                                },
                            },
                        },
                    },
                    memberResults: {
                        where: { studentId: student.id },
                        include: {
                            student: { select: { id: true, studentCode: true, user: { select: { fullName: true } } } },
                        },
                    },
                    documents: {
                        where: { isDeleted: false },
                        select: { id: true, fileName: true, fileUrl: true, documentType: true, uploadedAt: true, uploadedBy: true },
                    },
                },
            });

            if (schedules.length === 0) {
                return {
                    success: false,
                    status: HTTP_STATUS.OK,
                    message: "Nhóm của bạn chưa có lịch bảo vệ nào trong kỳ hiện tại!",
                };
            }

            return {
                success: true,
                status: HTTP_STATUS.OK,
                message: "Lấy lịch bảo vệ thành công!",
                data: schedules,
            };
        } catch (error) {
            console.error("Lỗi khi lấy lịch bảo vệ:", error);
            return {
                success: false,
                status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
                message: "Lỗi hệ thống!",
            };
        }
    }

    // Leader thêm URL báo cáo
    async addUrlToDefenseSchedule(scheduleId: string, url: string, userId: string) {
        try {
            // 1. Kiểm tra URL hợp lệ
            if (!url || !url.match(/^https?:\/\/.+/)) {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: "URL phải bắt đầu bằng http:// hoặc https://"
                };
            }
    
            // 2. Lấy thông tin defense schedule
            const defenseSchedule = await prisma.defenseSchedule.findUnique({
                where: { id: scheduleId, isDeleted: false },
                include: {
                    group: {
                        select: {
                            id: true,
                            groupCode: true,
                            members: {
                                where: { isDeleted: false },
                                select: {
                                    studentId: true,
                                    roleId: true,
                                    student: {
                                        select: { userId: true }
                                    }
                                }
                            }
                        }
                    }
                }
            });
    
            if (!defenseSchedule) {
                return {
                    success: false,
                    status: HTTP_STATUS.NOT_FOUND,
                    message: "Lịch bảo vệ không tồn tại!"
                };
            }
    
            // 3. Kiểm tra user có trong nhóm không
            const userInGroup = defenseSchedule.group.members.find(
                member => member.student && member.student.userId === userId
            );
    
            if (!userInGroup) {
                return {
                    success: false,
                    status: HTTP_STATUS.FORBIDDEN,
                    message: "Bạn không thuộc nhóm có lịch bảo vệ này!"
                };
            }
    
            // 4. Kiểm tra role leader
            const leaderRole = await prisma.role.findUnique({
                where: { name: "leader" }
            });
    
            if (userInGroup.roleId !== leaderRole?.id) {
                return {
                    success: false,
                    status: HTTP_STATUS.FORBIDDEN,
                    message: "Chỉ leader của nhóm mới được thêm URL!"
                };
            }
    
            // 5. Kiểm tra trùng URL
            const existingDoc = await prisma.document.findFirst({
                where: {
                    defenseScheduleId: scheduleId,
                    documentType: "DEFENSE_REPORT",
                    isDeleted: false
                }
            });
    
            if (existingDoc) {
                return {
                    success: false,
                    status: HTTP_STATUS.CONFLICT,
                    message: "Nhóm đã có báo cáo cho lịch bảo vệ này!",
                    data: existingDoc
                };
            }
    
            // 6. Tạo document mới
            const newDocument = await prisma.document.create({
                data: {
                    fileName: `Báo cáo bảo vệ - ${defenseSchedule.group.groupCode}`,
                    fileUrl: url,
                    fileType: "URL",
                    documentType: "DEFENSE_REPORT",
                    defenseScheduleId: scheduleId,
                    uploadedBy: userId
                }
            });
    
            return {
                success: true,
                status: HTTP_STATUS.OK,
                message: "Thêm URL báo cáo thành công!",
                data: newDocument
            };
    
        } catch (error) {
            console.error("Lỗi khi thêm URL:", error);
            return {
                success: false,
                status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
                message: "Lỗi hệ thống khi thêm URL!"
            };
        }
    }
    // Thành viên hội đồng xem chi tiết
    async getDefenseCouncilDetailsForMember(councilId: string, userId: string) {
        try {
            // Kiểm tra xem user có phải thành viên hội đồng không
            const isMember = await prisma.councilMember.findFirst({ where: { councilId, userId, isDeleted: false } });
            if (!isMember) {
                return { success: false, status: HTTP_STATUS.FORBIDDEN, message: "Bạn không phải thành viên hội đồng!" };
            }

            // Lấy thông tin chi tiết hội đồng với tất cả quan hệ liên quan
            const council = await prisma.council.findUnique({
                where: { id: councilId, type: "DEFENSE", isDeleted: false },
                include: {
                    members: {
                        include: {
                            user: { select: { id: true, fullName: true, email: true } }, // Thông tin user của thành viên hội đồng
                            role: { select: { id: true, name: true } }, // Vai trò của thành viên
                        },
                    },
                    semester: { select: { id: true, code: true, startDate: true, endDate: true, status: true } }, // Học kỳ liên quan
                    submissionPeriod: { select: { id: true, roundNumber: true, startDate: true, endDate: true, status: true } }, // Đợt xét duyệt
                    defenseSchedules: {
                        include: {
                            group: {
                                include: {
                                    members: {
                                        include: {
                                            student: { select: { id: true, studentCode: true, user: { select: { fullName: true, email: true } } } }, // Sinh viên trong nhóm
                                            role: { select: { id: true, name: true } }, // Vai trò trong nhóm (leader, member)
                                        },
                                    },
                                    mentors: {
                                        include: {
                                            mentor: { select: { id: true, fullName: true, email: true } }, // Mentor của nhóm
                                            role: { select: { id: true, name: true } }, // Vai trò của mentor
                                        },
                                    },
                                    topicAssignments: {
                                        include: {
                                            topic: { select: { id: true, topicCode: true, name: true, status: true } }, // Đề tài được phân công
                                        },
                                    },
                                },
                            },
                            memberResults: {
                                include: {
                                    student: { select: { id: true, studentCode: true, user: { select: { fullName: true } } } }, // Sinh viên được đánh giá
                                },
                            },
                            documents: {
                                where: { isDeleted: false },
                                select: { id: true, fileName: true, fileUrl: true, documentType: true, uploadedAt: true, uploadedBy: true },
                            },
                        },
                    },
                    documents: {
                        where: { isDeleted: false },
                        select: { id: true, fileName: true, fileUrl: true, documentType: true, uploadedAt: true, uploadedBy: true },
                    },
                },
            });

            if (!council) {
                return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Hội đồng không tồn tại!" };
            }

            return { success: true, status: HTTP_STATUS.OK, message: "Lấy chi tiết hội đồng thành công!", data: council };
        } catch (error) {
            console.error("Lỗi khi lấy chi tiết hội đồng:", error);
            return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
        }
    }

    // Đánh giá từng sinh viên
    async evaluateDefenseMember(
        defenseScheduleId: string,
        studentId: string,
        data: { result: "PASS" | "NOT_PASS"; feedback?: string },
        userId: string
    ) {
        try {
            // 1. Kiểm tra vai trò từ UserRole
            const userRoles = await prisma.userRole.findMany({
                where: {
                    userId,
                    isActive: true,
                    isDeleted: false,
                },
                include: { role: { select: { name: true } } }, // Chỉ lấy name để tối ưu
            });

            const roleNames = userRoles.map((ur) => ur.role.name);
            // console.log("User roles:", roleNames);

            // 2. Các vai trò được phép
            const allowedRoles = ["lecturer", "council_chairman", "council_secretary", "council_member"];
            const hasPermission = roleNames.some((role) => allowedRoles.includes(role));

            if (!hasPermission) {
                return {
                    success: false,
                    status: HTTP_STATUS.FORBIDDEN,
                    message: "Bạn không có quyền đánh giá (yêu cầu lecturer hoặc vai trò hội đồng)!",
                };
            }

            // 3. Kiểm tra lịch bảo vệ có tồn tại không
            const defenseSchedule = await prisma.defenseSchedule.findUnique({
                where: {
                    id: defenseScheduleId,
                    isDeleted: false,
                },
            });

            if (!defenseSchedule) {
                return {
                    success: false,
                    status: HTTP_STATUS.NOT_FOUND,
                    message: "Lịch bảo vệ không tồn tại!",
                };
            }

            // 4. Kiểm tra sinh viên có trong lịch bảo vệ không
            const defenseMember = await prisma.defenseMemberResult.findUnique({
                where: {
                    defenseScheduleId_studentId: {
                        defenseScheduleId: defenseScheduleId,
                        studentId: studentId,
                    },
                    isDeleted: false,
                },
            });

            if (!defenseMember) {
                return {
                    success: false,
                    status: HTTP_STATUS.NOT_FOUND,
                    message: "Sinh viên không thuộc lịch bảo vệ này!",
                };
            }

            // 5. Cập nhật kết quả đánh giá
            const updatedResult = await prisma.defenseMemberResult.update({
                where: {
                    defenseScheduleId_studentId: {
                        defenseScheduleId: defenseScheduleId,
                        studentId: studentId,
                    },
                },
                data: {
                    result: data.result,
                    feedback: data.feedback,
                    evaluatedBy: userId,
                    evaluatedAt: new Date(),
                },
            });

            return {
                success: true,
                status: HTTP_STATUS.OK,
                message: "Đánh giá thành công!",
                data: updatedResult,
            };
        } catch (error) {
            console.error("Lỗi khi đánh giá:", error);
            return {
                success: false,
                status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
                message: "Lỗi hệ thống!",
            };
        }
    }
    // Thay đổi thành viên hội đồng bảo vệ
    async updateDefenseCouncilMembers(councilId: string, members: { email: string; role: string }[], updatedBy: string) {
        try {
            const council = await prisma.council.findUnique({ where: { id: councilId, type: "DEFENSE", isDeleted: false } });
            if (!council) {
                return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Hội đồng bảo vệ không tồn tại!" };
            }

            // Lấy cấu hình từ SystemConfigService
            const minChairman = await systemConfigService.getMinDefenseChairman(); // 1
            const maxChairman = await systemConfigService.getMaxDefenseChairman(); // 1
            const minSecretary = await systemConfigService.getMinDefenseSecretary(); // 1
            const maxSecretary = await systemConfigService.getMaxDefenseSecretary(); // 1
            const minReviewers = await systemConfigService.getMinDefenseReviewers(); // 3
            const maxReviewers = await systemConfigService.getMaxDefenseReviewers(); // 3
            const maxDefenseMembers = await systemConfigService.getMaxDefenseMembers(); // 5

            // Xóa toàn bộ thành viên hiện tại (soft delete)
            await prisma.councilMember.updateMany({
                where: { councilId, isDeleted: false },
                data: { isDeleted: true },
            });

            // Thêm lại danh sách thành viên mới trong transaction
            const updatedMembers = await prisma.$transaction(async (tx) => {
                const newMembers: any[] | PromiseLike<any[]> = [];

                // Lấy roleId của các vai trò trước
                const chairmanRole = await tx.role.findUnique({ where: { name: "council_chairman" } });
                const secretaryRole = await tx.role.findUnique({ where: { name: "council_secretary" } });
                const memberRole = await tx.role.findUnique({ where: { name: "council_member" } });

                // Thêm thành viên mới
                for (const member of members) {
                    const user = await tx.user.findUnique({ where: { email: member.email }, select: { id: true } });
                    if (!user) {
                        throw new Error(`Không tìm thấy người dùng với email: ${member.email}`);
                    }

                    const role = await tx.role.findUnique({ where: { name: member.role } });
                    if (!role) {
                        throw new Error(`Vai trò ${member.role} không tồn tại!`);
                    }

                    const newMember = await tx.councilMember.create({
                        data: {
                            councilId,
                            userId: user.id,
                            roleId: role.id,
                            assignedAt: new Date(),
                            status: "ACTIVE",
                            semesterId: council.semesterId || '',
                        },
                    });
                    newMembers.push(newMember);
                }

                // Kiểm tra số lượng thành viên sau khi thêm
                const chairmanCount = newMembers.filter(m => m.roleId === chairmanRole?.id).length;
                const secretaryCount = newMembers.filter(m => m.roleId === secretaryRole?.id).length;
                const reviewerCount = newMembers.filter(m => m.roleId === memberRole?.id).length;
                const totalMemberCount = newMembers.length;

                if (
                    totalMemberCount !== maxDefenseMembers ||
                    chairmanCount !== minChairman ||
                    secretaryCount !== minSecretary ||
                    reviewerCount !== minReviewers
                ) {
                    throw new Error(`Hội đồng phải có đúng ${minChairman} chủ tịch, ${minSecretary} thư ký, và ${minReviewers} thành viên thường (tổng cộng ${maxDefenseMembers} người)!`);
                }

                return newMembers;
            });

            return {
                success: true,
                status: HTTP_STATUS.OK,
                message: "Thay đổi thành viên hội đồng thành công!",
                data: updatedMembers,
            };
        } catch (error) {
            console.error("Lỗi khi thay đổi thành viên hội đồng:", error);
            return {
                success: false,
                status: HTTP_STATUS.BAD_REQUEST,
                message: error instanceof Error ? error.message : "Lỗi hệ thống khi thay đổi thành viên hội đồng!",
            };
        }
    }
}