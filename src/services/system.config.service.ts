import { PrismaClient, SystemConfig } from "@prisma/client";

const prisma = new PrismaClient();

export class SystemConfigService {
  constructor() {}

  async getSystemConfigValue(key: string, defaultValue: number | string): Promise<number | string> {
    try {
      const config = await prisma.systemConfig.findUnique({ 
        where: { configKey: key, isDeleted: false }
      });
      if (config) {
        return typeof defaultValue === "number" ? Number(config.configValue) : config.configValue;
      }
      return defaultValue;
    } catch (error) {
      throw new Error(`Failed to get config value for key ${key}: ${(error as Error).message}`);
    }
  }

  async updateSystemConfig(
    key: string, 
    value: string, 
    updatedBy: string, 
    description?: string, 
    ipAddress: string = "unknown"
  ): Promise<SystemConfig> {
    try {
      const existingConfig = await prisma.systemConfig.findUnique({
        where: { configKey: key }
      });

      const updatedConfig = await prisma.systemConfig.upsert({
        where: { configKey: key },
        update: { 
          configValue: value, 
          updatedBy, 
          description,
          isDeleted: false
        },
        create: { 
          configKey: key, 
          configValue: value, 
          updatedBy, 
          description,
          isDeleted: false
        },
      });

      await prisma.systemLog.create({
        data: {
          userId: updatedBy,
          action: "UPDATE",
          entityType: "SystemConfig",
          entityId: updatedConfig.id,
          description: `Updated config ${key} from ${existingConfig?.configValue || "N/A"} to ${value}`,
          severity: "INFO",
          ipAddress,
          oldValues: existingConfig ? { configValue: existingConfig.configValue } : undefined,
          newValues: { configValue: value },
          metadata: description ? { description } : undefined
        }
      });

      return updatedConfig;
    } catch (error) {
      await prisma.systemLog.create({
        data: {
          userId: updatedBy,
          action: "UPDATE",
          entityType: "SystemConfig",
          entityId: key,
          description: `Failed to update config ${key}`,
          error: (error as Error).message,
          stackTrace: (error as Error).stack,
          severity: "ERROR",
          ipAddress,
          oldValues: undefined,
          newValues: undefined,
          metadata: undefined
        }
      });
      throw new Error(`Failed to update config for key ${key}: ${(error as Error).message}`);
    }
  }

  // Thêm phương thức liệt kê tất cả key hợp lệ
  async getAllConfigKeys(): Promise<{ key: string; defaultValue: number | string }[]> {
    return [
      { key: "MAX_GROUP_MEMBERS", defaultValue: 5 },
      { key: "MAX_GROUP_MENTORS", defaultValue: 2 },
      { key: "MAX_GROUPS_PER_MENTOR", defaultValue: 4 },
      { key: "MAX_TOPICS_PER_COUNCIL_SCHEDULE", defaultValue: 4 },
      { key: "MIN_DEFENSE_MEMBERS", defaultValue: 5 },
      { key: "MAX_DEFENSE_MEMBERS", defaultValue: 5 },
      { key: "MIN_DEFENSE_CHAIRMAN", defaultValue: 1 },
      { key: "MAX_DEFENSE_CHAIRMAN", defaultValue: 1 },
      { key: "MIN_DEFENSE_SECRETARY", defaultValue: 1 },
      { key: "MAX_DEFENSE_SECRETARY", defaultValue: 1 },
      { key: "MIN_DEFENSE_REVIEWERS", defaultValue: 3 },
      { key: "MAX_DEFENSE_REVIEWERS", defaultValue: 3 },
      { key: "MAX_REVIEW_MEMBERS", defaultValue: 2 },
      { key: "MAX_COUNCIL_MEMBERS", defaultValue: 2 },
      { key: "MAX_COUNCILS_PER_SEMESTER", defaultValue: 5 },
      { key: "AI_TOPIC_FILTER_COUNT", defaultValue: 3 },
    ];
  }

  async getMaxGroupMembers(): Promise<number> {
    return this.getSystemConfigValue("MAX_GROUP_MEMBERS", 5) as Promise<number>;
  }

  async getMaxGroupMentors(): Promise<number> {
    return this.getSystemConfigValue("MAX_GROUP_MENTORS", 2) as Promise<number>;
  }

  async getMaxGroupsPerMentor(): Promise<number> {
    return this.getSystemConfigValue("MAX_GROUPS_PER_MENTOR", 4) as Promise<number>;
  }

  async getMaxTopicsPerCouncilSchedule(): Promise<number> {
    return this.getSystemConfigValue("MAX_TOPICS_PER_COUNCIL_SCHEDULE", 4) as Promise<number>;
  }

  async getMinDefenseMembers(): Promise<number> {
    return this.getSystemConfigValue("MIN_DEFENSE_MEMBERS", 5) as Promise<number>;
  }

  async getMaxDefenseMembers(): Promise<number> {
    return this.getSystemConfigValue("MAX_DEFENSE_MEMBERS", 5) as Promise<number>;
  }

  async getMinDefenseChairman(): Promise<number> {
    return this.getSystemConfigValue("MIN_DEFENSE_CHAIRMAN", 1) as Promise<number>;
  }

  async getMaxDefenseChairman(): Promise<number> {
    return this.getSystemConfigValue("MAX_DEFENSE_CHAIRMAN", 1) as Promise<number>;
  }

  async getMinDefenseSecretary(): Promise<number> {
    return this.getSystemConfigValue("MIN_DEFENSE_SECRETARY", 1) as Promise<number>;
  }

  async getMaxDefenseSecretary(): Promise<number> {
    return this.getSystemConfigValue("MAX_DEFENSE_SECRETARY", 1) as Promise<number>;
  }

  async getMinDefenseReviewers(): Promise<number> {
    return this.getSystemConfigValue("MIN_DEFENSE_REVIEWERS", 3) as Promise<number>;
  }

  async getMaxDefenseReviewers(): Promise<number> {
    return this.getSystemConfigValue("MAX_DEFENSE_REVIEWERS", 3) as Promise<number>;
  }

  async getMaxReviewMembers(): Promise<number> {
    return this.getSystemConfigValue("MAX_REVIEW_MEMBERS", 2) as Promise<number>;
  }

  async getMaxCouncilMembers(): Promise<number> {
    return this.getSystemConfigValue("MAX_COUNCIL_MEMBERS", 2) as Promise<number>;
  }

  async getMaxCouncilsPerSemester(): Promise<number> {
    return this.getSystemConfigValue("MAX_COUNCILS_PER_SEMESTER", 5) as Promise<number>;
  }

  async getAITopicFilterCount(): Promise<number> {
    return this.getSystemConfigValue("AI_TOPIC_FILTER_COUNT", 3) as Promise<number>;
  }

}