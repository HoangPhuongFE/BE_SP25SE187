import { PrismaClient } from '@prisma/client';
import HTTP_STATUS from '../constants/httpStatus';
import COUNCIL_MESSAGE from '../constants/message';
import { SystemConfigService } from '../service/system.config.service';

const prisma = new PrismaClient();
const systemConfigService = new SystemConfigService();

export class CouncilService {
    async createCouncil(data: {
        topicAssId: null;
        name: string;
        type?: string;
        round?: number;
        semesterId?: string | null;
        status?: string;
    }) {
        try {
            const { name, type, round, semesterId, status } = data;
            const council = await prisma.council.create({
                data: {
                    name,
                    type,
                    round,
                    semesterId: semesterId ?? null,
                    status: status || 'ACTIVE'
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

    async addCouncilMembers(councilId: string, members: { userId: string; role: string }[]) {
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

            // Kiểm tra số lượng thành viên tối đa
            if (councilType === "review" && currentMembers.length + members.length > maxReviewMembers) {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: COUNCIL_MESSAGE.MAX_MEMBERS_EXCEEDED
                };
            }

            if (councilType === "defense" && currentMembers.length + members.length > maxDefenseMembers) {
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

            for (const newMember of members) {
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
            const dataForInsert = members.map((m) => ({
                councilId,
                userId: m.userId,
                role: m.role,
                status: 'ACTIVE'
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
                message: COUNCIL_MESSAGE.COUNCIL_MEMBERS_FAILED
            };
        }
    }


    async getCouncils(filter: { semesterId?: string; type?: string }) {
        try {
            const { semesterId, type } = filter;
            const councils = await prisma.council.findMany({
                where: {
                    ...(semesterId && { semesterId }),
                    ...(type && { type })
                },
                include: {
                    members: { include: { user: true } },
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

    async getLecturersRolesInSemester(semesterId: string) {
        try {
            const memberships = await prisma.councilMember.findMany({
                where: {
                    council: {
                        semesterId
                    }
                },
                include: {
                    user: true,
                    council: true
                }
            });

            // Gom group theo userId
            const mapUserRoles = new Map<string, any>();
            for (const mem of memberships) {
                const uid = mem.userId;
                if (!mapUserRoles.has(uid)) {
                    mapUserRoles.set(uid, {
                        userId: mem.user.id,
                        fullName: mem.user.fullName,
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

            const result = Array.from(mapUserRoles.values());

            return {
                success: true,
                status: HTTP_STATUS.OK,
                message: COUNCIL_MESSAGE.LECTURERS_ROLES_FETCHED,
                data: result
            };
        } catch (error) {
            return {
                success: false,
                status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
                message: COUNCIL_MESSAGE.LECTURERS_ROLES_FAILED
            };
        }
    }


    async removeCouncilMember(councilId: string, userId: string) {
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
            const minMembers = councilType === "review"
                ? await systemConfigService.getMaxReviewMembers() // Nếu cần có số lượng tối thiểu riêng, có thể tạo thêm hàm getMinReviewMembers()
                : await systemConfigService.getMaxDefenseMembers(); // Nếu cần số lượng tối thiểu riêng, có thể tạo thêm hàm getMinDefenseMembers()
    
            if (currentMembers.length - 1 < minMembers) {
                return {
                    success: false,
                    status: HTTP_STATUS.BAD_REQUEST,
                    message: COUNCIL_MESSAGE.MIN_MEMBERS_REQUIRED
                };
            }
    
            // Xóa thành viên khỏi hội đồng
            await prisma.councilMember.deleteMany({
                where: { councilId, userId }
            });
    
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
    
}
