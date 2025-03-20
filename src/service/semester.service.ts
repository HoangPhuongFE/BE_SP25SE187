import { PrismaClient } from "@prisma/client";
import HTTP_STATUS from "~/constants/httpStatus";
import { SEMESTER_MESSAGE } from "~/constants/message";
import { paginate } from "~/helpers/pagination.helper";

const prisma = new PrismaClient();

export class SemesterService {
  // Lấy danh sách semester theo yearId, phân trang
  async getSemestersByYear(yearId: string, page: number, pageSize: number) {
    return paginate(prisma.semester, { page, pageSize }, { where: { yearId } });
  }

  // Tạo mới semester: tính trạng thái tự động dựa trên thời gian
  async createSemester(
    yearId: string,
    code: string,
    startDate: Date,
    endDate: Date,
    status: string
  ) {
    if (startDate >= endDate) {
      throw new Error("Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc.");
    }
    const now = new Date();
    let computedStatus = status;
    if (now < startDate) {
      computedStatus = "UPCOMING";
    } else if (now >= startDate && now <= endDate) {
      computedStatus = "ACTIVE";
    } else {
      computedStatus = "COMPLETE";
    }

    return prisma.semester.create({
      data: {
        yearId,
        code,
        startDate,
        endDate,
        status: computedStatus,
      },
    });
  }

  // Cập nhật semester: Cho phép cập nhật mọi trạng thái, không ràng buộc theo thời gian hiện tại
  async updateSemester(
    id: string, code: string, startDate: Date, endDate: Date, status: any) {
    if (startDate >= endDate) {
      throw new Error("Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc.");
    }

    const now = new Date();
    let computedStatus: string;
    if (now < startDate) {
      computedStatus = "UPCOMING";
    } else if (now >= startDate && now <= endDate) {
      computedStatus = "ACTIVE";
    } else {
      computedStatus = "COMPLETE";
    }

    return prisma.semester.update({
      where: { id },
      data: {
        code,
        startDate,
        endDate,
        status: computedStatus,
      },
    });
  }


  // Xóa semester: Xóa tất cả dữ liệu liên quan trước khi xóa semester
  async deleteSemester(id: string) {
    const semester = await prisma.semester.findUnique({
      where: { id },
      include: {
        semesterStudents: true,
        reviewDefenseCouncils: true,
        topics: true,
        groups: true,
        councils: true,
        reviewCouncils: true,
        decisions: true,
        SubmissionPeriod: true,
        userRoles: true
      }
    });

    if (!semester) {
      throw new Error(SEMESTER_MESSAGE.SEMESTER_NOT_FOUND);
    }

    // Xóa tất cả dữ liệu liên quan đến semester
    await prisma.$transaction([
      // Xóa các bảng liên quan đến semester
      prisma.semesterStudent.deleteMany({
        where: { semesterId: id }
      }),
      prisma.reviewDefenseCouncil.deleteMany({
        where: { semesterId: id }
      }),
      prisma.topic.deleteMany({
        where: { semesterId: id }
      }),
      prisma.group.deleteMany({
        where: { semesterId: id }
      }),
      prisma.council.deleteMany({
        where: { semesterId: id }
      }),
      prisma.reviewCouncil.deleteMany({
        where: { semesterId: id }
      }),
      prisma.decision.deleteMany({
        where: { semesterId: id }
      }),
      prisma.submissionPeriod.deleteMany({
        where: { semesterId: id }
      }),
      prisma.userRole.deleteMany({
        where: { semesterId: id }
      }),
      // Xóa semester
      prisma.semester.delete({
        where: { id }
      })
    ]);

    return semester;
  }

  // Lấy tất cả semester
  async getAllSemesters() {
    const semesters = await prisma.semester.findMany();
    console.log("Semesters:", semesters);
    return semesters;
  }

  // Lấy semester theo id, kèm quan hệ year
  async getSemesterById(id: string) {
    try {
      const semester = await prisma.semester.findUnique({
        where: { id },
        include: { year: true },
      });

      if (!semester) {
        return {
          success: false,
          status: HTTP_STATUS.OK,
          data: [],
          message: SEMESTER_MESSAGE.SEMESTER_NOT_FOUND,
        };
      }

      return {
        success: true,
        status: HTTP_STATUS.OK,
        data: semester,
      };
    } catch (error) {
      console.error("Lỗi khi lấy semester theo ID:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống!",
      };
    }
  }
}

