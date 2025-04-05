// controllers/semester-role.controller.ts
import { Request, Response } from 'express';
import HTTP_STATUS from '../constants/httpStatus';
import { SemesterRoleService, FlexibleRoleIdentifier } from '../services/user-semester-role.service';

const semesterRoleService = new SemesterRoleService();

export class SemesterRoleController {
  // Tạo phân công vai trò linh hoạt (POST /api/semester-roles)
  async createSemesterRole(req: Request, res: Response) {
    try {
      // Dữ liệu đầu vào có thể bao gồm: userId hoặc userEmail, roleId hoặc roleName, semesterId hoặc semesterCode, isActive
      const data: FlexibleRoleIdentifier & { isActive?: boolean } = req.body;
      const result = await semesterRoleService.createSemesterRole(data);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Error in createSemesterRole controller:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi hệ thống khi tạo vai trò học kỳ!",
      });
    }
  }

  // Cập nhật phân công vai trò linh hoạt (PUT /api/semester-roles/flexible)
  async updateSemesterRole(req: Request, res: Response) {
    try {
      // Flexible input có thể truyền qua body: userId/userEmail, roleId/roleName, semesterId/semesterCode và data cập nhật dưới key "data"
      const input: FlexibleRoleIdentifier = req.body; // Chứa thông tin định danh linh hoạt
      const updateData = req.body.data; // Ví dụ: { isActive: false }
      if (!updateData) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Thiếu dữ liệu cập nhật (data)!",
        });
      }
      const result = await semesterRoleService.updateSemesterRoleFlexible(input, updateData);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Error in updateSemesterRole controller:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi hệ thống khi cập nhật vai trò học kỳ!",
      });
    }
  }

  // Xóa phân công vai trò linh hoạt (DELETE /api/semester-roles/flexible)
  async deleteSemesterRole(req: Request, res: Response) {
    try {
      // Có thể nhận thông tin từ query hoặc body
      const input: FlexibleRoleIdentifier = req.query.userId || req.query.roleId || req.query.semesterId
        ? {
            userId: req.query.userId as string,
            roleId: req.query.roleId as string,
            semesterId: req.query.semesterId as string,
          }
        : req.body;
      if (
        !(input.userId || input.userEmail) ||
        !(input.roleId || input.roleName) ||
        !(input.semesterId || input.semesterCode)
      ) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Thiếu thông tin cần thiết cho xóa (userId/userEmail, roleId/roleName, semesterId/semesterCode)!",
        });
      }
      const result = await semesterRoleService.deleteSemesterRoleFlexible(input);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Error in deleteSemesterRole controller:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi hệ thống khi xóa vai trò học kỳ!",
      });
    }
  }

  // Lấy danh sách vai trò theo học kỳ (GET /api/semester-roles?semesterId=...)
  async getRolesBySemester(req: Request, res: Response) {
    try {
      const { semesterId } = req.query;
      if (!semesterId || typeof semesterId !== 'string') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Thiếu hoặc không hợp lệ semesterId!",
        });
      }
      const result = await semesterRoleService.getRolesBySemester(semesterId);
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Error in getRolesBySemester controller:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi hệ thống khi lấy vai trò học kỳ!",
      });
    }
  }
}
