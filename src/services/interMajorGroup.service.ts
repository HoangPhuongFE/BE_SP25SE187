import { PrismaClient } from "@prisma/client";
import HTTP_STATUS from '../constants/httpStatus';
import { GROUP_MESSAGE } from '../constants/message';
import { SystemConfigService } from '../services/system.config.service';

const prisma = new PrismaClient();
const systemConfigService = new SystemConfigService();  

export class InterMajorGroupService {
  async createGroup(data: { leaderId: string; majorPairConfigId: string }) {
    try {
      const { leaderId, majorPairConfigId } = data;

      // 1. Tìm học kỳ UPCOMING
      const upcomingSemester = await prisma.semester.findFirst({
        where: {
          status: 'UPCOMING',
          isDeleted: false,
          startDate: { gte: new Date() },
        },
        orderBy: { startDate: 'asc' },
        select: { id: true, startDate: true },
      });

      if (!upcomingSemester) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: 'Không tìm thấy học kỳ sắp tới.',
        };
      }

      const semesterId = upcomingSemester.id;

      // 2. Kiểm tra majorPairConfig tồn tại và active
      const majorPairConfig = await prisma.majorPairConfig.findUnique({
        where: { id: majorPairConfigId },
      });

      if (!majorPairConfig || !majorPairConfig.isActive) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: 'Cấu hình liên ngành không hợp lệ.',
        };
      }

      // 3. Kiểm tra trưởng nhóm
      const leader = await prisma.student.findUnique({
        where: { userId: leaderId },
        include: { major: true },
      });

      if (!leader || !leader.major) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: 'Sinh viên trưởng nhóm không tồn tại hoặc chưa gán chuyên ngành.',
        };
      }

      // 4. Kiểm tra đủ điều kiện học kỳ
      const studentSemester = await prisma.semesterStudent.findFirst({
        where: { studentId: leader.id, semesterId },
      });
      if (!studentSemester || studentSemester.qualificationStatus.trim().toLowerCase() !== 'qualified') {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: 'Sinh viên không đủ điều kiện tham gia học kỳ.',
        };
      }

      // 5. Kiểm tra đã thuộc nhóm chưa
      const existingMembership = await prisma.groupMember.findFirst({
        where: { studentId: leader.id, group: { semesterId } },
      });
      if (existingMembership) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: 'Sinh viên đã là thành viên của một nhóm.',
        };
      }

      // 6. Tạo mã nhóm
      const groupCode = await this.generateUniqueGroupCode('IM', semesterId, new Date(upcomingSemester.startDate));

      const maxMembers = await systemConfigService.getMaxGroupMembers(); 
      if (maxMembers <= 0) throw new Error('Số lượng thành viên tối đa không hợp lệ.');

      const leaderRole = await prisma.role.findUnique({ where: { name: 'leader' } });
      if (!leaderRole) throw new Error('Vai trò leader không tồn tại.');

      // 7. Tạo nhóm liên ngành
      const newGroup = await prisma.group.create({
        data: {
          groupCode,
          semesterId,
          status: 'ACTIVE',
          createdBy: leaderId,
          maxMembers,
          isMultiMajor: true,
          majorPairConfigId,
          members: {
            create: [
              {
                studentId: leader.id,
                roleId: leaderRole.id,
                status: 'ACTIVE',
                userId: leaderId,
              },
            ],
          },
        },
        include: {
          members: { include: { role: true } },
        },
      });

      return {
        success: true,
        status: HTTP_STATUS.CREATED,
        message: GROUP_MESSAGE.GROUP_CREATED,
        data: {
          ...newGroup,
          members: newGroup.members.map((m) => ({
            studentId: m.studentId,
            role: m.role.name,
            status: m.status,
          })),
        },
      };
    } catch (error) {
      console.error('Lỗi khi tạo nhóm liên ngành:', error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: 'Lỗi hệ thống khi tạo nhóm liên ngành.',
      };
    }
  }

  private async generateUniqueGroupCode(prefix: string, semesterId: string, startDate: Date) {
    const year = startDate.getFullYear().toString().slice(-2);
    let count = 1;
    let groupCode = `${prefix}${year}_${count}`;

    while (true) {
      const exists = await prisma.group.findUnique({
        where: { semesterId_groupCode: { semesterId, groupCode } },
      });
      if (!exists) break;
      count++;
      groupCode = `${prefix}${year}_${count}`;
    }
    return groupCode;
  }
}
