// 📁 src/services/thesisAssignment.service.ts

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class ThesisAssignmentService {
  async createThesisAssignment(data: any, createdBy: string) {
    const newAssignment = await prisma.decision.create({
      data: {
        decisionName: data.decisionName,
        decisionTitle: data.decisionTitle,
        decisionDate: data.decisionDate ? new Date(data.decisionDate) : undefined,
        semesterId: data.semesterId,
        createdBy,
        // Các trường khác của Decision sẽ có giá trị mặc định (null)
      },
    });

    return {
      id: newAssignment.id,
      decisionName: newAssignment.decisionName,
      decisionTitle: newAssignment.decisionTitle,
      decisionDate: newAssignment.decisionDate,
      semesterId: data.semesterId,
      createdBy: newAssignment.createdBy,
      createdAt: newAssignment.createdAt,
      isDeleted: newAssignment.isDeleted,
      
    };
  }

  async getThesisAssignmentById(id: string) {
    const assignment = await prisma.decision.findUnique({ where: { id } });
    if (!assignment) throw new Error("Không tìm thấy quyết định giao/hướng dẫn khóa luận");

    return {
      id: assignment.id,
      decisionName: assignment.decisionName,
      decisionTitle: assignment.decisionTitle,
      decisionDate: assignment.decisionDate,
      semesterId: assignment.semesterId,
      createdBy: assignment.createdBy,
      createdAt: assignment.createdAt,
      isDeleted: assignment.isDeleted,
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
      semesterId: a.semesterId,
      createdBy: a.createdBy,
      createdAt: a.createdAt,
      isDeleted: a.isDeleted,
    }));
  }

  async updateThesisAssignment(id: string, data: any) {
    const existing = await prisma.decision.findUnique({ where: { id } });
    if (!existing) throw new Error("Không tìm thấy quyết định giao/hướng dẫn khóa luận");

    const updated = await prisma.decision.update({
      where: { id },
      data: {
        decisionName: data.decisionName,
        decisionTitle: data.decisionTitle,
        decisionDate: data.decisionDate ? new Date(data.decisionDate) : undefined,
        semesterId: data.semesterId,
      },
    });

    return {
      id: updated.id,
      decisionName: updated.decisionName,
      decisionTitle: updated.decisionTitle,
      decisionDate: updated.decisionDate,
      semesterId: updated.semesterId,
      createdBy: updated.createdBy,
      createdAt: updated.createdAt,
      isDeleted: updated.isDeleted,
    };
  }

  async deleteThesisAssignment(id: string) {
    const existing = await prisma.decision.findUnique({ where: { id } });
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
      semesterId: deleted.semesterId,
      createdBy: deleted.createdBy,
      createdAt: deleted.createdAt,
      isDeleted: deleted.isDeleted,
    };
  }
}