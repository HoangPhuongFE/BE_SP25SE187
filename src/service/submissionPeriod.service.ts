import { PrismaClient } from "@prisma/client";
import HTTP_STATUS from "../constants/httpStatus";
import { TOPIC_SUBMISSION_PERIOD_MESSAGE } from "../constants/message";

const prisma = new PrismaClient();

export class SubmissionPeriodService {
  // Tạo một đợt đề xuất mới, thêm kiểm tra quyền ở đây
  async createSubmissionPeriod(data: {
    semesterId: string;
    roundNumber: number;
    startDate: Date;
    endDate: Date;
    description?: string;
    createdBy: string;
  }) {
    try {
      // Kiểm tra quyền của người tạo (createdBy) - không cho phép academic_officer tạo đợt đề xuất
      const creator = await prisma.user.findUnique({
        where: { id: data.createdBy },
        include: { roles: { include: { role: true } } },
      });
      if (!creator) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: "Người tạo không tồn tại!",
        };
      }
      const creatorRoles = creator.roles.map((r) => r.role.name.toLowerCase());
      // Nếu người tạo có vai trò academic_officer, từ chối thao tác tạo đợt đề xuất
      if (creatorRoles.includes("academic_officer")|| creatorRoles.includes("admin")) {
        return {
          success: false,
          status: HTTP_STATUS.FORBIDDEN,
          message: "Academic officer không được phép tạo đợt đề xuất.",
        };
      }

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

      // Kiểm tra rằng startDate < endDate
      if (data.startDate >= data.endDate) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: "Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc.",
        };
      }

      // Tính toán trạng thái tự động dựa trên thời gian
      const status = this.determineStatus(data.startDate, data.endDate);

      // Tạo đợt đề xuất mới
      const newPeriod = await prisma.submissionPeriod.create({
        data: {
          semesterId: data.semesterId,
          roundNumber: data.roundNumber,
          startDate: data.startDate,
          endDate: data.endDate,
          description: data.description || "",
          createdBy: data.createdBy,
          status, // Lưu trạng thái đã tính toán
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
  
      // Nếu có cung cấp cả startDate và endDate mới, kiểm tra hợp lệ
      if (data.startDate && data.endDate && data.endDate < data.startDate) {
        return {
          success: false,
          status: HTTP_STATUS.BAD_REQUEST,
          message: "Ngày kết thúc không thể trước ngày bắt đầu.",
        };
      }
  
      // Sử dụng giá trị mới nếu có, ngược lại giữ nguyên giá trị cũ
      const newStartDate = data.startDate ?? existingPeriod.startDate;
      const newEndDate = data.endDate ?? existingPeriod.endDate;
  
      // Tính trạng thái mới dựa trên newStartDate và newEndDate
      const updatedStatus = this.determineStatus(new Date(newStartDate), new Date(newEndDate));
  
      // Cập nhật đợt đề xuất với dữ liệu mới và trạng thái tính toán lại
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

      // Tính toán trạng thái mới
      const updatedPeriods = periods.map((period) => {
        const newStatus = this.determineStatus(new Date(period.startDate), new Date(period.endDate));

        // Cập nhật trạng thái trong DB nếu khác với hiện tại
        if (newStatus !== period.status) {
          prisma.submissionPeriod.update({
            where: { id: period.id },
            data: { status: newStatus }
          }).catch(err => console.error(`Lỗi cập nhật trạng thái: ${err}`));
        }

        return { ...period, status: newStatus };
      });

      return { success: true, status: HTTP_STATUS.OK, data: updatedPeriods };
    } catch (error) {
      console.error(" Lỗi khi lấy danh sách đợt đề xuất:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
    }
  }

  //  Lấy thông tin một đợt đề xuất theo ID
  async getSubmissionPeriodById(periodId: string) {
    try {
      const period = await prisma.submissionPeriod.findUnique({ where: { id: periodId } });
      
      if (!period) {
        return {
          success: false,
          status: HTTP_STATUS.OK,
          data: [],
          message : TOPIC_SUBMISSION_PERIOD_MESSAGE.NOT_FOUND
        };
      } 

      // Tính toán trạng thái mới
      const newStatus = this.determineStatus(new Date(period.startDate), new Date(period.endDate));

      // Nếu trạng thái khác DB, cập nhật lại
      if (newStatus !== period.status) {
        await prisma.submissionPeriod.update({
          where: { id: period.id },
          data: { status: newStatus }
        });
      }

      return { success: true, status: HTTP_STATUS.OK, data: { ...period, status: newStatus } };
    } catch (error) {
      console.error(" Lỗi khi lấy đợt đề xuất theo ID:", error);
      return { success: false, status: HTTP_STATUS.INTERNAL_SERVER_ERROR, message: "Lỗi hệ thống!" };
    }
  }


  //  Xóa đợt đề xuất
  async deleteSubmissionPeriod(periodId: string) {
    try {
      const period = await prisma.submissionPeriod.findUnique({
        where: { id: periodId },
        include: {
          topics: true,
          councils: true,
          topicRegistrations: true
        }
      });
    
      if (!period) {
        return {
          success: false,
          status: HTTP_STATUS.NOT_FOUND,
          message: TOPIC_SUBMISSION_PERIOD_MESSAGE.NOT_FOUND,
        };
      }

      // Xóa tất cả dữ liệu liên quan đến submission period
      await prisma.$transaction([
        // Xóa các bảng liên quan đến submission period
        prisma.topic.deleteMany({
          where: { submissionPeriodId: periodId }
        }),
        prisma.council.deleteMany({
          where: { submissionPeriodId: periodId }
        }),
        prisma.topicRegistration.deleteMany({
          where: { submissionPeriodId: periodId }
        }),
        // Xóa submission period
        prisma.submissionPeriod.delete({
          where: { id: periodId }
        })
      ]);
    
      return { 
        success: true, 
        status: HTTP_STATUS.OK, 
        message: TOPIC_SUBMISSION_PERIOD_MESSAGE.DELETED,
        data: period
      };
    } catch (error: any) {
      console.error("Lỗi khi xóa đợt đề xuất:", error);
      return { 
        success: false, 
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR, 
        message: error.message || "Lỗi hệ thống!"
      };
    }
  }
  
  

  //  Hàm xác định trạng thái SubmissionPeriod
  private determineStatus(startDate: Date, endDate: Date): string {
    const now = new Date(); // Lấy thời gian hiện tại của server
    const start = new Date(startDate); // Chuyển đổi startDate về cùng kiểu Date
    const end = new Date(endDate); // Chuyển đổi endDate về cùng kiểu Date

    if (now < start) return "UPCOMING"; // Chưa bắt đầu
    if (now >= start && now <= end) return "ACTIVE"; // Đang mở
    return "COMPLETE"; // Đã kết thúc
}

}
