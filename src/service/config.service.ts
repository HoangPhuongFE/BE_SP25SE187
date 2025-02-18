import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class ConfigService {
    // 🔹 Giá trị cấu hình mặc định nếu DB chưa có
    private static readonly DEFAULT_CONFIG: Record<string, string> = {
        CHANGE_LEADER_DEADLINE_DAYS: "7",  // Số ngày cho phép đổi leader
        MAX_GROUP_MEMBERS: "5",  // Số thành viên tối đa trong nhóm
        MAX_GROUP_MENTORS: "2",  // Số mentor tối đa trong nhóm
    };

    // 🔹 Lấy giá trị cấu hình từ DB hoặc trả về mặc định
    static async getConfigValue(key: string): Promise<string> {
        const config = await prisma.systemConfig.findUnique({
            where: { configKey: key }
        });

        return config ? config.configValue : (this.DEFAULT_CONFIG[key] || "");
    }

    // 🔹 Lấy toàn bộ danh sách cấu hình (kết hợp giá trị mặc định nếu DB chưa có)
    static async getAllConfigs() {
        const configs = await prisma.systemConfig.findMany();
        const configMap = Object.fromEntries(configs.map(cfg => [cfg.configKey, cfg.configValue]));

        return { ...this.DEFAULT_CONFIG, ...configMap };
    }

    // 🔹 Cập nhật giá trị cấu hình (chỉ Admin)
    static async updateConfig(key: string, value: string, adminId: string) {
        const user = await prisma.user.findUnique({
            where: { id: adminId },
            include: { roles: true }
        });

        const isAdmin = user?.roles.some(role => role.roleId === "admin");
        if (!isAdmin) throw new Error("Bạn không có quyền cập nhật cấu hình.");

        await prisma.systemConfig.upsert({
            where: { configKey: key },
            update: { configValue: value },
            create: {
                configKey: key,
                configValue: value,
                description: `Cấu hình hệ thống cho ${key}`,
                user: { connect: { id: adminId } }
            }
        });

        return { message: `Cập nhật ${key} thành ${value}.` };
    }

    // 🔹 Trả về số ngày tối đa cho phép đổi leader
    static async getLeaderChangeDeadline(): Promise<number> {
        const value = await this.getConfigValue("CHANGE_LEADER_DEADLINE_DAYS");
        return Number(value) || 7; // Mặc định 7 ngày
    }

    // 🔹 Trả về số mentor tối đa trong một nhóm
    static async getMaxMentorsPerGroup(): Promise<number> {
        const value = await this.getConfigValue("MAX_GROUP_MENTORS");
        return Number(value) || 2; // Mặc định 2 mentor
    }

    // Lấy tất cả cấu hình rồi lọc ra các key được yêu cầu
    static async getFilteredConfigs(keys: string[]): Promise<Record<string, string>> {
        const allConfigs = await this.getAllConfigs();
        const filteredConfigs: Record<string, string> = {};

        keys.forEach(key => {
            if (allConfigs[key] !== undefined) {
                filteredConfigs[key] = allConfigs[key];
            }
        });

        return filteredConfigs;
    }

}
