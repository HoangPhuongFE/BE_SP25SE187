// system.config.service.ts
import { PrismaClient, SystemConfig } from "@prisma/client";
const prisma = new PrismaClient();

export class SystemConfigService {
  private prisma = new PrismaClient();

  async getSystemConfigValue(key: string, defaultValue: number | string): Promise<number | string> {
    const config = await this.prisma.systemConfig.findUnique({ where: { configKey: key } });
    if (config) {
      return typeof defaultValue === "number" ? Number(config.configValue) : config.configValue;
    }
    return defaultValue;
  }

  async updateSystemConfig(key: string, value: string, updatedBy: string, description?: string): Promise<SystemConfig> {
    return await this.prisma.systemConfig.upsert({
      where: { configKey: key },
      update: { configValue: value, updatedBy, description },
      create: { configKey: key, configValue: value, updatedBy, description },
    });
  }

  // Cấu hình số lượng thành viên nhóm
  async getMaxGroupMembers(): Promise<number> {
    return this.getSystemConfigValue("MAX_GROUP_MEMBERS", 5) as Promise<number>;
  }

  async getMaxGroupMentors(): Promise<number> {
    return this.getSystemConfigValue("MAX_GROUP_MENTORS", 2) as Promise<number>;
  }

  // Thêm cấu hình số lượng nhóm tối đa mà một mentor có thể hướng dẫn
  async getMaxGroupsPerMentor(): Promise<number> {
    return this.getSystemConfigValue("MAX_GROUPS_PER_MENTOR", 4) as Promise<number>;
  }

  // Các phương thức khác giữ nguyên...
  async getMaxReviewMembers(): Promise<number> {
    return this.getSystemConfigValue("MAX_REVIEW_MEMBERS", 2) as Promise<number>;
  }

  async getMaxDefenseMembers(): Promise<number> {
    return this.getSystemConfigValue("MAX_DEFENSE_MEMBERS", 4) as Promise<number>;
  }

  async getMaxDefenseChairman(): Promise<number> {
    return this.getSystemConfigValue("MAX_DEFENSE_CHAIRMAN", 1) as Promise<number>;
  }

  async getMaxDefenseSecretary(): Promise<number> {
    return this.getSystemConfigValue("MAX_DEFENSE_SECRETARY", 1) as Promise<number>;
  }

  async getMaxDefenseReviewers(): Promise<number> {
    return this.getSystemConfigValue("MAX_DEFENSE_REVIEWERS", 2) as Promise<number>;
  }

  async getMaxCouncilMembers(): Promise<number> {
    return this.getSystemConfigValue("MAX_COUNCIL_MEMBERS", 2) as Promise<number>;
  }

  async getMaxCouncilsPerSemester(): Promise<number> {
    return this.getSystemConfigValue("MAX_COUNCILS_PER_SEMESTER", 5) as Promise<number>;
  }
}