// 📁 src/controllers/thesisAssignment.controller.ts

import { Request, Response } from "express";
import { ThesisAssignmentService } from "../service/thesisAssignmentDecision.service";
import { createThesisAssignmentSchema, updateThesisAssignmentSchema } from "../validators/thesisAssignment.schema";

const thesisAssignmentService = new ThesisAssignmentService();

export const createThesisAssignmentController = async (req: Request, res: Response) => {
  const result = createThesisAssignmentSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Dữ liệu không hợp lệ",
      errors: result.error.flatten().fieldErrors,
    });
  }

  try {
    const createdBy = req.user?.userId; // Lấy userId từ token
    if (!createdBy) {
      return res.status(401).json({ success: false, message: "Không xác định được người tạo (token thiếu userId)" });
    }

    const created = await thesisAssignmentService.createThesisAssignment(result.data, createdBy);
    return res.status(201).json({
      success: true,
      message: "Tạo quyết định giao/hướng dẫn khóa luận thành công",
      data: created,
    });
  } catch (error: any) {
    console.error("Lỗi tạo quyết định giao/hướng dẫn khóa luận:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi tạo quyết định giao/hướng dẫn khóa luận",
      error: error.message,
    });
  }
};

export const getAllThesisAssignmentsController = async (_: Request, res: Response) => {
  try {
    const assignments = await thesisAssignmentService.getAllThesisAssignments();
    return res.json({ data: assignments });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi lấy danh sách quyết định giao/hướng dẫn khóa luận" });
  }
};

export const getThesisAssignmentByIdController = async (req: Request, res: Response) => {
  try {
    const assignment = await thesisAssignmentService.getThesisAssignmentById(req.params.id);
    return res.json({ data: assignment });
  } catch (error: any) {
    return res.status(404).json({ message: error.message });
  }
};

export const updateThesisAssignmentController = async (req: Request, res: Response) => {
  const result = updateThesisAssignmentSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: "Dữ liệu không hợp lệ", errors: result.error.flatten().fieldErrors });
  }
  try {
    const updated = await thesisAssignmentService.updateThesisAssignment(req.params.id, result.data);
    return res.json({ message: "Cập nhật quyết định giao/hướng dẫn khóa luận thành công", data: updated });
  } catch (error: any) {
    return res.status(500).json({ message: "Lỗi cập nhật quyết định giao/hướng dẫn khóa luận", error: error.message });
  }
};

export const deleteThesisAssignmentController = async (req: Request, res: Response) => {
  try {
    const deleted = await thesisAssignmentService.deleteThesisAssignment(req.params.id);
    return res.json({ message: "Xóa quyết định giao/hướng dẫn khóa luận thành công", data: deleted });
  } catch (error: any) {
    return res.status(500).json({ message: "Lỗi xóa quyết định giao/hướng dẫn khóa luận", error: error.message });
  }
};