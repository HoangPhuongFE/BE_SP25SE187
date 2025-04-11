import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class ThesisAssignmentService {
  async createThesisAssignment(data: any, createdBy: string) {
    const newAssignment = await prisma.decision.create({
      data: {
        decisionName: data.decisionName,
        decisionTitle: data.decisionTitle,
        decisionDate: data.decisionDate ? new Date(data.decisionDate) : undefined,
        type: data.type, // Thêm trường type
        createdBy,
      },
    });

    return {
      id: newAssignment.id,
      decisionName: newAssignment.decisionName,
      decisionTitle: newAssignment.decisionTitle,
      decisionDate: newAssignment.decisionDate,
      createdBy: newAssignment.createdBy,
      createdAt: newAssignment.createdAt,
      isDeleted: newAssignment.isDeleted,
      type: newAssignment.type, // Thêm vào response
    };
  }

 async getThesisAssignmentById(id: string) {
  const assignment = await prisma.decision.findUnique({
    where: { id, isDeleted: false },
  });

  if (!assignment) {
    return {
      success: true,
      message: "Không tìm thấy quyết định giao/hướng dẫn khóa luận",
      data: null,
    };
  }

  return {
    success: true,
    data: {
      id: assignment.id,
      decisionName: assignment.decisionName,
      decisionTitle: assignment.decisionTitle,
      decisionDate: assignment.decisionDate,
      createdBy: assignment.createdBy,
      createdAt: assignment.createdAt,
      isDeleted: assignment.isDeleted,
      type: assignment.type,
    },
  };
}

  async getAllThesisAssignments() {
    const assignments = await prisma.decision.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: "desc" },
    });

    return assignments.map((a) => ({
      id: a.id,
      decisionName: a.decisionName,
      decisionTitle: a.decisionTitle,
      decisionDate: a.decisionDate,
      createdBy: a.createdBy,
      createdAt: a.createdAt,
      isDeleted: a.isDeleted,
      type: a.type, // Thêm vào response
    }));
  }

  async updateThesisAssignment(id: string, data: any) {
    const existing = await prisma.decision.findUnique({
      where: { id, isDeleted: false },
    });
    if (!existing) throw new Error("Không tìm thấy quyết định giao/hướng dẫn khóa luận");

    const updated = await prisma.decision.update({
      where: { id },
      data: {
        decisionName: data.decisionName,
        decisionTitle: data.decisionTitle,
        decisionDate: data.decisionDate ? new Date(data.decisionDate) : undefined,
        type: data.type, // Thêm trường type
      },
    });

    return {
      id: updated.id,
      decisionName: updated.decisionName,
      decisionTitle: updated.decisionTitle,
      decisionDate: updated.decisionDate,
      createdBy: updated.createdBy,
      createdAt: updated.createdAt,
      isDeleted: updated.isDeleted,
      type: updated.type, // Thêm vào response
    };
  }

  async deleteThesisAssignment(id: string) {
    const existing = await prisma.decision.findUnique({
      where: { id, isDeleted: false },
    });
    if (!existing) throw new Error("Không tìm thấy quyết định giao/hướng dẫn khóa luận");

    const deleted = await prisma.decision.update({
      where: { id },
      data: { isDeleted: true },
    });

    return {
      id: deleted.id,
      decisionName: deleted.decisionName,
      decisionTitle: deleted.decisionTitle,
      decisionDate: deleted.decisionDate,
      createdBy: deleted.createdBy,
      createdAt: deleted.createdAt,
      isDeleted: deleted.isDeleted,
      type: deleted.type, // Thêm vào response
    };
  }

  async restoreThesisAssignment(id: string) {
    const existing = await prisma.decision.findUnique({
      where: { id },
    });
    if (!existing) throw new Error("Không tìm thấy quyết định giao/hướng dẫn khóa luận");
    if (!existing.isDeleted) throw new Error("Quyết định này chưa bị xóa mềm");

    const restored = await prisma.decision.update({
      where: { id },
      data: { isDeleted: false },
    });

    return {
      id: restored.id,
      decisionName: restored.decisionName,
      decisionTitle: restored.decisionTitle,
      decisionDate: restored.decisionDate,
      createdBy: restored.createdBy,
      createdAt: restored.createdAt,
      isDeleted: restored.isDeleted,
      type: restored.type, // Thêm vào response
    };
  }
}