import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "./user.middleware";

const prisma = new PrismaClient();


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


export const checkLeaderOrMentor = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const groupId = req.body.groupId || req.params.groupId; 
    const userId = req.user!.userId;

    if (!groupId) {
      return res.status(400).json({ message: "Thiếu groupId trong request." });
    }

    //  Kiểm tra nếu user là admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { select: { role: true } } },
    });

    if (!user) {
      return res.status(401).json({ message: "Người dùng không tồn tại." });
    }

    const isAdmin = user.roles.some((r) => r.role.name === "admin");
    if (isAdmin) {
      return next(); 
    }

    //  Kiểm tra nếu user là sinh viên (leader hoặc mentor)
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { id: true }
    });

    if (!student) {
      return res.status(403).json({ message: "Bạn không có quyền thực hiện thao tác này (không phải sinh viên)." });
    }

    // Kiểm tra nếu user là LEADER hoặc MENTOR trong nhóm
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        studentId: student.id,
        role: { in: ["leader", "mentor"] } 
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



export const checkGroupLeaderMentorOrAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const userId = req.user!.userId;

    // 1. Kiểm tra nếu user là admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { select: { role: true } } },
    });

    if (!user) {
      return res.status(401).json({ message: "Người dùng không tồn tại." });
    }

    const isAdmin = user.roles.some((r) => r.role.name === "admin");
    if (isAdmin) {
      return next(); // Admin có quyền xóa
    }

    // 2. Kiểm tra nếu user là sinh viên trong nhóm
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      return res.status(403).json({ message: "Bạn không phải sinh viên." });
    }

    // 3. Kiểm tra nếu user là Leader hoặc Mentor trong nhóm
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        studentId: student.id,
        role: { in: ["LEADER", "MENTOR"] },
      },
    });

    if (!membership) {
      return res.status(403).json({ message: "Bạn không phải leader hoặc mentor của nhóm này." });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
