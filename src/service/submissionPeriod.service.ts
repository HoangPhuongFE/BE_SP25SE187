import { PrismaClient } from "@prisma/client";
import HTTP_STATUS from "../constants/httpStatus";

const prisma = new PrismaClient();

export class SubmissionPeriodService {
  async createSubmissionPeriod(data: {
    semesterId: string;
    roundNumber: number;
    startDate: Date;
    endDate: Date;
    description?: string;
    createdBy: string;
  }) {
    try {
      const existingPeriod = await prisma.submissionPeriod.findFirst({
        where: { semesterId: data.semesterId, roundNumber: data.roundNumber },
      });

      if (existingPeriod) {
        return {
          success: false,
          status: HTTP_STATUS.CONFLICT,
          message: "Đợt đề xuất đã tồn tại!",
        };
      }

      const newPeriod = await prisma.submissionPeriod.create({
        data: {
          semesterId: data.semesterId,
          roundNumber: data.roundNumber,
          startDate: data.startDate,
          endDate: data.endDate,
          description: data.description  || "Không có mô tả",
          createdBy: data.createdBy,
        },
      });

      return {
        success: true,
        status: HTTP_STATUS.CREATED,
        message: "Tạo đợt đề xuất thành công!",
        data: newPeriod,
      };
    } catch (error) {
      console.error("Lỗi khi tạo đợt đề xuất:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống!",
      };
    }
  }

  async updateSubmissionPeriod(periodId: string, data: Partial<{ startDate: Date; endDate: Date; description?: string }>) {
    try {
      const existingPeriod = await prisma.submissionPeriod.findUnique({ where: { id: periodId } });

      if (!existingPeriod) {
        return { success: false, status: HTTP_STATUS.NOT_FOUND, message: "Không tìm thấy đợt đề xuất!" };
      }

      const updatedPeriod = await prisma.submissionPeriod.update({
        where: { id: periodId },
        data,
      });

      return { success: true, status: HTTP_STATUS.OK, message: "Cập nhật đợt đề xuất thành công!", data: updatedPeriod };
    } catch (error) {
      console.error("Lỗi khi cập nhật đợt đề xuất:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
    }
  }

  async getSubmissionPeriods(semesterId: string) {
    try {
      const periods = await prisma.submissionPeriod.findMany({
        where: { semesterId },
        orderBy: { roundNumber: "asc" },
      });

      return { success: true, status: HTTP_STATUS.OK, data: periods };
    } catch (error) {
      console.error("Lỗi khi lấy danh sách đợt đề xuất:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
    }
  }

  async getSubmissionPeriodById(periodId: string) {
    try {
      const period = await prisma.submissionPeriod.findUnique({
        where: { id: periodId },
      });

      if (!period) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Không tìm thấy đợt đề xuất!",
        };
      }

      return { success: true, status: HTTP_STATUS.OK, data: period };
    } catch (error) {
      console.error("Lỗi khi lấy đợt đề xuất theo ID:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
    }
  }

  async deleteSubmissionPeriod(periodId: string) {
    try {
      await prisma.submissionPeriod.delete({ where: { id: periodId } });

      return { success: true, status: HTTP_STATUS.OK, message: "Xóa đợt đề xuất thành công!" };
    } catch (error) {
      console.error("Lỗi khi xóa đợt đề xuất:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
    }
  }
}
