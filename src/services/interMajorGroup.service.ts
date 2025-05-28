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
      select: { id: true, firstMajorId: true, secondMajorId: true, isActive: true, semesterId: true },
    });

    if (!majorPairConfig || !majorPairConfig.isActive) {
      return {
        success: false,
        status: HTTP_STATUS.NOT_FOUND,
        message: 'Cấu hình liên ngành không hợp lệ hoặc không hoạt động.',
      };
    }

    // Kiểm tra majorPairConfig thuộc học kỳ
    if (majorPairConfig.semesterId !== semesterId) {
      return {
        success: false,
        status: HTTP_STATUS.BAD_REQUEST,
        message: 'Cấu hình liên ngành không thuộc học kỳ sắp tới.',
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

    // Kiểm tra chuyên ngành của trưởng nhóm có trong majorPairConfig không
    if (
      leader.major.id !== majorPairConfig.firstMajorId &&
      leader.major.id !== majorPairConfig.secondMajorId
    ) {
      return {
        success: false,
        status: HTTP_STATUS.BAD_REQUEST,
        message: 'Chuyên ngành của trưởng nhóm không thuộc cấu hình liên ngành.',
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
      where: {
        studentId: leader.id,
        isDeleted: false,
        group: {
          semesterId,
          isDeleted: false,
        },
      },
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

  async createInterMajorGroupByAcademicOfficer(input: {
    leaderEmail: string;
    majorPairConfigId: string;
    createdBy: string;
  }) {
    const { leaderEmail, majorPairConfigId, createdBy } = input;

    try {
      // 1. Validate input
      if (!leaderEmail || !majorPairConfigId || !createdBy) {
        return {
          success: false,
          status: 400,
          message: "Thiếu thông tin leaderEmail, majorPairConfigId hoặc người tạo.",
        };
      }

      // 2. Kiểm tra majorPairConfig
      const config = await prisma.majorPairConfig.findUnique({
        where: { id: majorPairConfigId },
        include: { semester: true },
      });

      if (!config || !config.isActive || config.isDeleted) {
        return {
          success: false,
          status: 404,
          message: "Cấu hình liên ngành không hợp lệ hoặc không tồn tại.",
        };
      }

      const semesterId = config.semesterId;
      const semester = config.semester;

      // 3. Tìm trưởng nhóm theo email
      const leader = await prisma.student.findFirst({
        where: { user: { email: leaderEmail } },
        include: { user: true, major: true },
      });

      if (!leader || !leader.major) {
        return {
          success: false,
          status: 404,
          message: "Trưởng nhóm không tồn tại hoặc chưa gán chuyên ngành.",
        };
      }

      // 4. Kiểm tra sinh viên thuộc học kỳ
      const studentSemester = await prisma.semesterStudent.findFirst({
        where: { studentId: leader.id, semesterId },
      });

      if (!studentSemester) {
        return {
          success: false,
          status: 400,
          message: "Sinh viên không thuộc học kỳ liên ngành.",
        };
      }

      if (studentSemester.qualificationStatus.trim().toLowerCase() !== "qualified") {
        return {
          success: false,
          status: 400,
          message: `Sinh viên không đủ điều kiện. Trạng thái: ${studentSemester.qualificationStatus}`,
        };
      }

      // 5. Kiểm tra đã thuộc nhóm chưa
      const existingMember = await prisma.groupMember.findFirst({
        where: {
          studentId: leader.id,
          isDeleted: false,
          group: {
            semesterId,
            isDeleted: false,
          },
        },
      });


      if (existingMember) {
        return {
          success: false,
          status: 400,
          message: "Sinh viên đã là thành viên của một nhóm trong học kỳ này.",
        };
      }

      // 6. Sinh mã nhóm
      const groupCode = await this.generateUniqueGroupCode("IM", semesterId, new Date(semester.startDate));
      const maxMembers = await systemConfigService.getMaxGroupMembers();
      if (maxMembers <= 0) {
        return { success: false, status: 500, message: "Giá trị cấu hình số lượng thành viên không hợp lệ." };
      }

      const leaderRole = await prisma.role.findUnique({ where: { name: "leader" } });
      if (!leaderRole) {
        return { success: false, status: 500, message: "Vai trò leader không tồn tại." };
      }

      // 7. Tạo nhóm liên ngành
      const newGroup = await prisma.group.create({
        data: {
          groupCode,
          semesterId,
          createdBy,
          status: "ACTIVE",
          maxMembers,
          isMultiMajor: true,
          majorPairConfigId,
          members: {
            create: [
              {
                studentId: leader.id,
                roleId: leaderRole.id,
                status: "ACTIVE",
                userId: leader.userId,
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
        status: 201,
        message: "Nhóm liên ngành đã được tạo thành công.",
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
      console.error("Lỗi khi tạo nhóm liên ngành:", error);
      return {
        success: false,
        status: 500,
        message: "Lỗi hệ thống khi tạo nhóm liên ngành.",
      };
    }
  }

  private async generateUniqueGroupCode(prefix: string, semesterId: string, startDate: Date): Promise<string> {
  const year = startDate.getFullYear().toString().slice(-2);
  const groupCodePrefix = `${prefix}${year}_`;

  let sequence = 1;
  let groupCode = `${groupCodePrefix}${sequence}`;

  const maxAttempts = 1000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const exists = await prisma.group.findUnique({
      where: {
        semesterId_groupCode: {
          semesterId,
          groupCode,
        },
      },
    });

    if (!exists) return groupCode; // OK, chưa bị trùng → dùng mã này

    //  Đã tồn tại: tăng sequence và thử mã mới
    sequence++;
    groupCode = `${groupCodePrefix}${sequence}`;
  }

  throw new Error(`Không thể tạo mã nhóm duy nhất sau ${maxAttempts} lần thử.`);
}

}
