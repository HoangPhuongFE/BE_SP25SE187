// system.config.service.ts
import { PrismaClient, SystemConfig } from "@prisma/client";
const prisma = new PrismaClient();

export class SystemConfigService {
  /**
   * Lấy giá trị cấu hình theo key, trả về giá trị dưới dạng number hoặc string.
   * Nếu không tìm thấy, trả về giá trị mặc định.
   */
  async getSystemConfigValue(
    key: string,
    defaultValue: number | string
  ): Promise<number | string> {
    const config = await prisma.systemConfig.findUnique({
      where: { configKey: key },
    });
    if (config) {
      if (typeof defaultValue === "number") {
        return Number(config.configValue);
      }
      return config.configValue;
    }
    return defaultValue;
  }

  /**
   * Cập nhật (hoặc tạo mới) cấu hình trong hệ thống.
   */
  async updateSystemConfig(
    key: string,
    value: string,
    updatedBy: string,
    description?: string
  ): Promise<SystemConfig> {
    const updatedConfig = await prisma.systemConfig.upsert({
      where: { configKey: key },
      update: { configValue: value, updatedBy, description },
      create: { configKey: key, configValue: value, updatedBy, description },
    });
    return updatedConfig;
  }

  async getMaxGroupMembers(): Promise<number> {
    return this.getSystemConfigValue("MAX_GROUP_MEMBERS", 5) as Promise<number>;
  }

  async getMaxGroupMentors(): Promise<number> {
    return this.getSystemConfigValue("MAX_GROUP_MENTORS", 2) as Promise<number>;
  }
}
