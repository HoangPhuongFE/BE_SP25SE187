import { PrismaClient } from '@prisma/client';
import HTTP_STATUS from '../constants/httpStatus';
import COUNCIL_MESSAGE from '../constants/message';
import { SystemConfigService } from '../service/system.config.service';
import crypto from "crypto";

const prisma = new PrismaClient();
const systemConfigService = new SystemConfigService();

export class CouncilService {

    async createCouncil(data: {
        topicAssId?: string | null;
        name: string;
        code?: string;
        type?: string;
        round?: number;
        semesterId: string | null;
        status?: string;
    }) {
        try {
            if (!data.semesterId) {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: "Thiếu `semesterId`, vui lòng kiểm tra lại."
                };
            }
    
            // Sinh `council_code` nếu không có
            const councilCode = data.code || `${data.type?.toUpperCase()}-${data.round || 1}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    
            // Tạo hội đồng
            const council = await prisma.council.create({
                data: {
                    name: data.name,
                    code: councilCode,
                    type: data.type,
                    round: data.round,
                    semesterId: data.semesterId,
                    status: data.status || "ACTIVE"
                }
            });
    
            return {
                success: true,
                status: HTTP_STATUS.CREATED,
                message: COUNCIL_MESSAGE.COUNCIL_CREATED,
                data: council
            };
        } catch (error) {
            return {
                success: false,
                status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
                message: COUNCIL_MESSAGE.COUNCIL_CREATION_FAILED
            };
        }
    }
    
    
    async addCouncilMembers(
        councilId: string,
        members: { userId?: string; email?: string; role: string }[]
    ) {
        try {
            // Lấy thông tin hội đồng
            const council = await prisma.council.findUnique({
                where: { id: councilId }
            });
    
            if (!council) {
                return {
                    success: false,
                    status: HTTP_STATUS.NOT_FOUND,
                    message: COUNCIL_MESSAGE.COUNCIL_NOT_FOUND
                };
            }
    
            const councilType = council.type;
            const councilRound = council.round;
    
            // Lấy số lượng tối đa từ config
            const maxReviewMembers = await systemConfigService.getMaxReviewMembers();
            const maxDefenseMembers = await systemConfigService.getMaxDefenseMembers();
            const maxDefenseChairman = await systemConfigService.getMaxDefenseChairman();
            const maxDefenseSecretary = await systemConfigService.getMaxDefenseSecretary();
            const maxDefenseReviewers = await systemConfigService.getMaxDefenseReviewers();
    
            // Lấy danh sách thành viên hiện tại của hội đồng
            const currentMembers = await prisma.councilMember.findMany({
                where: { councilId }
            });
    
            // Tìm userId từ email nếu không có userId
            const emailUsers = await prisma.user.findMany({
                where: {
                    email: { in: members.filter(m => !m.userId && m.email).map(m => m.email!) }
                },
                select: { id: true, email: true }
            });
    
            const emailUserMap = new Map(emailUsers.map(user => [user.email, user.id]));
    
            // Ánh xạ lại danh sách members, nếu có email thì tìm userId
            const membersWithId = members.map(member => {
                if (member.userId) return member;
    
                const userId = emailUserMap.get(member.email!);
                if (!userId) {
                    throw new Error(`Không tìm thấy người dùng với email: ${member.email}`);
                }
    
                return { userId, role: member.role };
            });
    
            // Kiểm tra số lượng thành viên tối đa
            if (councilType === "review" && currentMembers.length + membersWithId.length > maxReviewMembers) {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: COUNCIL_MESSAGE.MAX_MEMBERS_EXCEEDED
                };
            }
    
            if (councilType === "defense" && currentMembers.length + membersWithId.length > maxDefenseMembers) {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: COUNCIL_MESSAGE.MAX_MEMBERS_EXCEEDED
                };
            }
    
            // Kiểm tra số lượng vai trò
            const roleCount: { [key: string]: number } = {
                chairman: 0,
                secretary: 0,
                reviewer: 0
            };
    
            currentMembers.forEach((member) => {
                if (roleCount[member.role] !== undefined) {
                    roleCount[member.role]++;
                }
            });
    
            for (const newMember of membersWithId) {
                if (newMember.role === "chairman" && roleCount.chairman >= maxDefenseChairman) {
                    return {
                        success: false,
                        status: HTTP_STATUS.BAD_REQUEST,
                        message: COUNCIL_MESSAGE.CHAIRMAN_LIMIT
                    };
                }
                if (newMember.role === "secretary" && roleCount.secretary >= maxDefenseSecretary) {
                    return {
                        success: false,
                        status: HTTP_STATUS.BAD_REQUEST,
                        message: COUNCIL_MESSAGE.SECRETARY_LIMIT
                    };
                }
                if (newMember.role === "reviewer" && roleCount.reviewer >= maxDefenseReviewers) {
                    return {
                        success: false,
                        status: HTTP_STATUS.BAD_REQUEST,
                        message: COUNCIL_MESSAGE.REVIEWER_LIMIT
                    };
                }
    
                if (roleCount[newMember.role] !== undefined) {
                    roleCount[newMember.role]++;
                }
            }
    
            // Thêm thành viên vào hội đồng
            const dataForInsert = membersWithId.map((m) => ({
                councilId,
                userId: m.userId!,
                role: m.role,
                status: 'ACTIVE',
                semesterId: council.semesterId ?? ''
            }));
    
            const result = await prisma.councilMember.createMany({
                data: dataForInsert
            });
    
            return {
                success: true,
                status: HTTP_STATUS.CREATED,
                message: COUNCIL_MESSAGE.COUNCIL_MEMBERS_ADDED,
                count: result.count
            };
        } catch (error) {
            return {
                success: false,
                status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
                message: COUNCIL_MESSAGE.COUNCIL_MEMBERS_FAILED,
                error: (error as any).message
            };
        }
    }
    
    
    

    async getCouncils(filter: { semesterId?: string; type?: string }) {
        try {
            const { semesterId, type } = filter;
    
            // Lấy danh sách hội đồng kèm danh sách thành viên
            const councils = await prisma.council.findMany({
                where: {
                    ...(semesterId && { semesterId }),
                    ...(type && { type })
                },
                include: {
                    members: {
                        include: {
                            user: {
                                select: { id: true, fullName: true, email: true }
                            }
                        }
                    },
                    semester: true
                }
            });
    
            return {
                success: true,
                status: HTTP_STATUS.OK,
                message: COUNCIL_MESSAGE.COUNCIL_LIST_FETCHED,
                data: councils
            };
        } catch (error) {
            return {
                success: false,
                status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
                message: COUNCIL_MESSAGE.COUNCIL_LIST_FAILED
            };
        }
    }
    

    async getLecturersRolesInSemester(semesterId: string, type?: string) {
        try {
            const memberships = await prisma.councilMember.findMany({
                where: {
                    council: {
                        semesterId,
                        ...(type && { type })
                    }
                },
                include: {
                    user: true,
                    council: true
                }
            });
    
            // Gom nhóm theo userId
            const mapUserRoles = new Map<string, any>();
            for (const mem of memberships) {
                const uid = mem.userId;
                if (!mapUserRoles.has(uid)) {
                    mapUserRoles.set(uid, {
                        userId: mem.user.id,
                        fullName: mem.user.fullName,
                        email: mem.user.email,
                        rolesInCouncils: []
                    });
                }
                mapUserRoles.get(uid).rolesInCouncils.push({
                    councilId: mem.councilId,
                    councilName: mem.council.name,
                    type: mem.council.type,
                    round: mem.council.round,
                    role: mem.role
                });
            }
    
            return {
                success: true,
                status: HTTP_STATUS.OK,
                message: COUNCIL_MESSAGE.LECTURERS_ROLES_FETCHED,
                data: Array.from(mapUserRoles.values())
            };
        } catch (error) {
            return {
                success: false,
                status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
                message: COUNCIL_MESSAGE.LECTURERS_ROLES_FAILED
            };
        }
    }
    


    async removeCouncilMember(councilId: string, userId?: string, email?: string) {
        try {
            // Lấy thông tin hội đồng
            const council = await prisma.council.findUnique({
                where: { id: councilId }
            });
    
            if (!council) {
                return {
                    success: false,
                    status: HTTP_STATUS.NOT_FOUND,
                    message: COUNCIL_MESSAGE.COUNCIL_NOT_FOUND
                };
            }
    
            // Nếu chỉ có email, lấy userId từ email
            if (!userId && email) {
                const user = await prisma.user.findUnique({
                    where: { email },
                    select: { id: true }
                });
    
                if (!user) {
                    return {
                        success: false,
                        status: HTTP_STATUS.NOT_FOUND,
                        message: `Không tìm thấy người dùng với email: ${email}`
                    };
                }
                userId = user.id;
            }
    
            if (!userId) {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: COUNCIL_MESSAGE.INVALID_REQUEST
                };
            }
    
            // Lấy danh sách thành viên hiện tại trong hội đồng
            const currentMembers = await prisma.councilMember.findMany({
                where: { councilId }
            });
    
            if (currentMembers.length === 0) {
                return {
                    success: false,
                    status: HTTP_STATUS.NOT_FOUND,
                    message: COUNCIL_MESSAGE.COUNCIL_MEMBER_NOT_FOUND
                };
            }
    
            // Kiểm tra số lượng tối thiểu từ config
            const minMembers = council.type === "review"
                ? await systemConfigService.getMaxReviewMembers()
                : await systemConfigService.getMaxDefenseMembers();
    
            if (currentMembers.length - 1 < minMembers) {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: COUNCIL_MESSAGE.MIN_MEMBERS_REQUIRED
                };
            }
    
            // Xóa thành viên khỏi hội đồng
            const deleted = await prisma.councilMember.deleteMany({
                where: { councilId, userId }
            });
    
            if (deleted.count === 0) {
                return {
                    success: false,
                    status: HTTP_STATUS.NOT_FOUND,
                    message: COUNCIL_MESSAGE.COUNCIL_MEMBER_NOT_FOUND
                };
            }
    
            return {
                success: true,
                status: HTTP_STATUS.OK,
                message: COUNCIL_MESSAGE.COUNCIL_MEMBER_REMOVED
            };
        } catch (error) {
            return {
                success: false,
                status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
                message: COUNCIL_MESSAGE.COUNCIL_MEMBER_REMOVE_FAILED
            };
        }
    }
    
    async deleteCouncil(councilId: string) {
        try {
            // Kiểm tra xem hội đồng có tồn tại không
            const existingCouncil = await prisma.council.findUnique({
                where: { id: councilId },
                include: {
                    members: true, // Kiểm tra có thành viên không
                    reviewAssignments: true, // Kiểm tra liên kết khác nếu cần
                    defenseSchedules: true
                }
            });
    
            if (!existingCouncil) {
                return {
                    success: false,
                    status: HTTP_STATUS.NOT_FOUND,
                    message: "Hội đồng không tồn tại."
                };
            }
    
            // Kiểm tra nếu hội đồng có thành viên -> Không cho xóa
            if (existingCouncil.members.length > 0) {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: "Không thể xóa hội đồng khi vẫn còn thành viên. Hãy xóa thành viên trước."
                };
            }
    
            // Kiểm tra nếu hội đồng có dữ liệu liên quan (Review/Defense)
            if (existingCouncil.reviewAssignments.length > 0 || existingCouncil.defenseSchedules.length > 0) {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: "Không thể xóa hội đồng khi vẫn còn dữ liệu liên quan."
                };
            }
    
            // Nếu không có vấn đề, tiến hành xóa hội đồng
            await prisma.council.delete({
                where: { id: councilId }
            });
    
            return {
                success: true,
                status: HTTP_STATUS.OK,
                message: "Hội đồng đã được xóa thành công."
            };
        } catch (error) {
            console.error("Lỗi khi xóa hội đồng:", error);
            return {
                success: false,
                status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
                message: "Lỗi server khi xóa hội đồng."
            };
        }
    }
    
}
