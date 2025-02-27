import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export class CouncilService {
    /**
     * Tạo 1 hội đồng mới
     */
    static async createCouncil(data: {
        topicAssId: null
        name: string
        type?: string
        round?: number
        semesterId?: string | null
        status?: string

      }) {
        const { name, type, round } = data;
        const council = await prisma.council.create({
          data: {
            name,
            type,
            round,
            semesterId: data.semesterId ?? null,
            status: data.status || 'ACTIVE'
          }
        })
        return council
      }
      

    /**
     * Thêm các thành viên vào 1 hội đồng
     */
    static async addCouncilMembers(
        councilId: string,
        members: { userId: string; role: string }[]
    ) {
        // Tạo mảng dữ liệu
        const dataForInsert = members.map((m) => ({
            councilId,
            userId: m.userId,
            role: m.role,
            status: 'ACTIVE'
        }))
        // createMany (Prisma 2.27+)
        const result = await prisma.councilMember.createMany({
            data: dataForInsert
        })
        return result
    }

    /**
     * Lấy danh sách hội đồng theo semesterId (nếu có),
     * hoặc lấy tất cả nếu không truyền semesterId
     */
    static async getCouncils(filter: { semesterId?: string; type?: string }) {
        const { semesterId, type } = filter
        const councils = await prisma.council.findMany({
            where: {
                ...(semesterId && { semesterId }), // nếu có semesterId -> filter
                ...(type && { type })             // nếu có type -> filter
            },
            include: {
                members: {
                    include: {
                        user: true // Lấy thông tin user (giảng viên)
                    }
                },
                semester: true
            }
        })
        return councils
    }

    /**
     * Lấy danh sách giảng viên + vai trò của họ trong học kỳ
     * - Chỉ list ra giảng viên đã tham gia hội đồng
     */
    static async getLecturersRolesInSemester(semesterId: string) {
        // Tìm tất cả councilMember -> join council (semesterId = X)
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
        })
        // memberships: mảng => { user, council, role, ... }

        // Gom group theo user.id
        const mapUserRoles = new Map<string, any>() // userId -> { user, roles: [] }
        for (const mem of memberships) {
            const uid = mem.userId
            if (!mapUserRoles.has(uid)) {
                mapUserRoles.set(uid, {
                    user: mem.user,
                    roles: []
                })
            }
            mapUserRoles.get(uid).roles.push({
                councilId: mem.councilId,
                councilName: mem.council.name,
                type: mem.council.type,
                round: mem.council.round,
                role: mem.role
            })
        }

        // Chuyển map -> array
        const result = Array.from(mapUserRoles.values()).map((item) => {
            return {
                userId: item.user.id,
                fullName: item.user.fullName,
                rolesInCouncils: item.roles
            }
        })
        return result
    }
}
