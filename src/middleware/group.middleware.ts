import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "./user.middleware";

const prisma = new PrismaClient();

/**
 * Middleware kiểm tra xem người dùng có thuộc nhóm hay không.
 * Yêu cầu: URL chứa tham số groupId
 */
export const checkGroupMembership = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const userId = req.user!.userId;

    // 1. Kiểm tra role của user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } }, // Lấy danh sách role của user
    });

    if (!user) {
      return res.status(403).json({ message: "Người dùng không tồn tại." });
    }

    // Lấy danh sách role của user
    const userRoles = user.roles.map((r) => r.role.name.toLowerCase());

    //  2. Nếu user là admin, graduation_thesis_manager, mentor, lecturer → Cho phép truy cập
    const allowedRoles = ["admin", "graduation_thesis_manager", "mentor", "lecturer"];
    if (userRoles.some((role) => allowedRoles.includes(role))) {
      return next(); // Bỏ qua kiểm tra nhóm, cho phép truy cập
    }

    //  3. Nếu user là sinh viên → Kiểm tra có thuộc nhóm không
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { id: true }
    });

    if (!student) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập nhóm (không phải sinh viên)." });
    }

    const membership = await prisma.groupMember.findFirst({
      where: { groupId, studentId: student.id }
    });

    if (!membership) {
      return res.status(403).json({ message: "Bạn không thuộc nhóm này." });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
/**
 * Middleware kiểm tra xem người dùng có phải là Leader hoặc Mentor của nhóm hay không.
 * Yêu cầu: URL chứa tham số groupId
 */
export const checkLeaderOrMentor = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const userId = req.user!.userId;

    // Lấy sinh viên tương ứng
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { id: true }
    });
    if (!student) {
      return res.status(403).json({ message: "Bạn không có quyền thực hiện thao tác này (không phải sinh viên)." });
    }

    // Kiểm tra vai trò trong nhóm
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        studentId: student.id,
        role: { in: ["LEADER", "MENTOR"] }
      }
    });

    if (!membership) {
      return res.status(403).json({ message: "Bạn không phải leader hoặc mentor của nhóm này." });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

/**
 * Middleware kiểm tra quyền admin.
 */
export const checkAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true }
    });

    const isAdmin = user?.roles.some(role => role.roleId.toLowerCase() === "admin");
    if (!isAdmin) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập chức năng này." });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
