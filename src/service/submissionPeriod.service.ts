import { PrismaClient } from "@prisma/client";
import HTTP_STATUS from "../constants/httpStatus";
import { TOPIC_SUBMISSION_PERIOD_MESSAGE } from "../constants/message";

const prisma = new PrismaClient();

export class SubmissionPeriodService {
  //  Tạo một đợt đề xuất mới
  async createSubmissionPeriod(data: {
    semesterId: string;
    roundNumber: number;
    startDate: Date;
    endDate: Date;
    description?: string;
    createdBy: string;
  }) {
    try {
      // Kiểm tra xem đợt này đã tồn tại chưa
      const existingPeriod = await prisma.submissionPeriod.findFirst({
        where: { semesterId: data.semesterId, roundNumber: data.roundNumber },
      });

      if (existingPeriod) {
        return {
          success: false,
          status: HTTP_STATUS.CONFLICT,
          message: TOPIC_SUBMISSION_PERIOD_MESSAGE.OVERLAPPED_PERIOD,
        };
      }

      // Xác định trạng thái tự động
      const status = this.determineStatus(data.startDate, data.endDate);

      const newPeriod = await prisma.submissionPeriod.create({
        data: {
          semesterId: data.semesterId,
          roundNumber: data.roundNumber,
          startDate: data.startDate,
          endDate: data.endDate,
          description: data.description || "Không có mô tả",
          createdBy: data.createdBy,
          status,
        },
      });

      return {
        success: true,
        status: HTTP_STATUS.CREATED,
        message: TOPIC_SUBMISSION_PERIOD_MESSAGE.CREATED,
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

  //  Cập nhật đợt đề xuất
  async updateSubmissionPeriod(
    periodId: string,
    data: Partial<{ startDate: Date; endDate: Date; description?: string }>
  ) {
    try {
      const existingPeriod = await prisma.submissionPeriod.findUnique({ where: { id: periodId } });

      if (!existingPeriod) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: TOPIC_SUBMISSION_PERIOD_MESSAGE.NOT_FOUND,
        };
      }

      // Kiểm tra nếu đợt đã hoàn thành (COMPLETE) thì không cho chỉnh sửa
      const currentStatus = this.determineStatus(existingPeriod.startDate, existingPeriod.endDate);
      if (currentStatus === "COMPLETE") {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: TOPIC_SUBMISSION_PERIOD_MESSAGE.CANNOT_UPDATE_COMPLETED,
        };
      }

      // Nếu đã ACTIVE, không cho thay đổi ngày bắt đầu
      if (currentStatus === "ACTIVE" && data.startDate) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Không thể thay đổi ngày bắt đầu khi đợt đề xuất đã bắt đầu.",
        };
      }

      // Kiểm tra nếu ngày kết thúc nhỏ hơn ngày bắt đầu
      if (data.endDate && data.startDate && data.endDate < data.startDate) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: "Ngày kết thúc không thể trước ngày bắt đầu.",
        };
      }

      // Nếu có thay đổi ngày, tính toán lại trạng thái
      const updatedStatus = this.determineStatus(
        data.startDate ?? existingPeriod.startDate,
        data.endDate ?? existingPeriod.endDate
      );

      const updatedPeriod = await prisma.submissionPeriod.update({
        where: { id: periodId },
        data: { ...data, status: updatedStatus },
      });

      return {
        success: true,
        status: HTTP_STATUS.OK,
        message: TOPIC_SUBMISSION_PERIOD_MESSAGE.UPDATED,
        data: updatedPeriod,
      };
    } catch (error) {
      console.error("Lỗi khi cập nhật đợt đề xuất:", error);
      return {
        success: false,
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: "Lỗi hệ thống!",
      };
    }
  }

  //  Lấy danh sách đợt đề xuất theo học kỳ
  async getSubmissionPeriods(semesterId: string) {
    try {
      const periods = await prisma.submissionPeriod.findMany({
        where: { semesterId },
        orderBy: { roundNumber: "asc" },
      });

      // Cập nhật trạng thái dựa trên thời gian hiện tại
      const updatedPeriods = periods.map((period) => ({
        ...period,
        status: this.determineStatus(period.startDate, period.endDate),
      }));

      return { success: true, status: HTTP_STATUS.OK, data: updatedPeriods };
    } catch (error) {
      console.error("Lỗi khi lấy danh sách đợt đề xuất:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
    }
  }

  //  Lấy thông tin một đợt đề xuất theo ID
  async getSubmissionPeriodById(periodId: string) {
    try {
      const period = await prisma.submissionPeriod.findUnique({
        where: { id: periodId },
      });

      if (!period) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: TOPIC_SUBMISSION_PERIOD_MESSAGE.NOT_FOUND,
        };
      }

      // Cập nhật trạng thái trước khi trả về
      const updatedPeriod = { ...period, status: this.determineStatus(period.startDate, period.endDate) };

      return { success: true, status: HTTP_STATUS.OK, data: updatedPeriod };
    } catch (error) {
      console.error("Lỗi khi lấy đợt đề xuất theo ID:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
    }
  }

  //  Xóa đợt đề xuất
  async deleteSubmissionPeriod(periodId: string) {
    try {
      const period = await prisma.submissionPeriod.findUnique({ where: { id: periodId } });

      if (!period) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: TOPIC_SUBMISSION_PERIOD_MESSAGE.NOT_FOUND,
        };
      }

      // Nếu đang ACTIVE, không cho phép xóa
      if (period.status === "ACTIVE") {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: TOPIC_SUBMISSION_PERIOD_MESSAGE.CANNOT_DELETE_ACTIVE,
        };
      }

      await prisma.submissionPeriod.delete({ where: { id: periodId } });

      return { success: true, status: HTTP_STATUS.OK, message: TOPIC_SUBMISSION_PERIOD_MESSAGE.DELETED };
    } catch (error) {
      console.error("Lỗi khi xóa đợt đề xuất:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
    }
  }

  //  Hàm xác định trạng thái SubmissionPeriod
  private determineStatus(startDate: Date, endDate: Date): string {
    const now = new Date();
    if (now < startDate) return "PENDING"; // Chưa bắt đầu
    if (now >= startDate && now <= endDate) return "ACTIVE"; // Đang mở
    return "COMPLETE"; // Đã kết thúc
  }
}
