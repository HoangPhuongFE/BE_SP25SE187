import { Request, Response } from "express";
import { DecisionService } from "../service/decision.service";
import { createDecisionSchema, updateDecisionSchema } from "../validators/decision.schema";

const decisionService = new DecisionService();

export const createDecisionController = async (req: Request, res: Response) => {
  const result = createDecisionSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Dữ liệu không hợp lệ",
      errors: result.error.flatten().fieldErrors,
    });
  }

  try {
    const createdBy = req.user?.userId; // lấy userId từ token
    if (!createdBy) {
      return res.status(401).json({ success: false, message: "Không xác định được người tạo (token thiếu userId)" });
    }

    const created = await decisionService.createDecision(result.data, createdBy);
    return res.status(201).json({
      success: true,
      message: "Tạo quyết định thành công",
      data: created,
    });
  } catch (error: any) {
    console.error("Lỗi tạo quyết định:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi tạo quyết định",
      error: error.message,
    });
  }
};

export const getAllDecisionsController = async (_: Request, res: Response) => {
  try {
    const decisions = await decisionService.getAllDecisions();
    return res.json({ data: decisions });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi lấy danh sách quyết định" });
  }
};

export const getDecisionByIdController = async (req: Request, res: Response) => {
  try {
    const decision = await decisionService.getDecisionById(req.params.id);
    return res.json({ data: decision });
  } catch (error: any) {
    return res.status(404).json({ message: error.message });
  }
};

export const updateDecisionController = async (req: Request, res: Response) => {
  const result = updateDecisionSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: "Dữ liệu không hợp lệ", errors: result.error.flatten().fieldErrors });
  }
  try {
    const updated = await decisionService.updateDecision(req.params.id, result.data);
    return res.json({ message: "Cập nhật quyết định thành công", data: updated });
  } catch (error: any) {
    return res.status(500).json({ message: "Lỗi cập nhật quyết định", error: error.message });
  }
};

export const deleteDecisionController = async (req: Request, res: Response) => {
  try {
    const deleted = await decisionService.deleteDecision(req.params.id);
    return res.json({ message: "Xóa quyết định thành công", data: deleted });
  } catch (error: any) {
    return res.status(500).json({ message: "Lỗi xóa quyết định", error: error.message });
  }
};
