// ============================
// 📁 src/services/decision.service.ts
// ============================

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class DecisionService {
  async createDecision(data: any, createdBy: string) {
    const newDecision = await prisma.decision.create({
      data: {
        decisionName: data.decisionName,
        decisionTitle: data.decisionTitle,
        decisionDate: data.decisionDate ? new Date(data.decisionDate) : undefined,
        basedOnJson: data.basedOn ? JSON.stringify(data.basedOn) : undefined,
        proposal: data.proposal,
        content: data.content,
        draftFile: data.draftFile,
        finalFile: data.finalFile,
        decisionURL: data.decisionURL,
        semesterId: data.semesterId,
        createdBy,
      },
    });

    return {
      ...newDecision,
      basedOn: newDecision.basedOnJson ? JSON.parse(newDecision.basedOnJson) : [],
    };
  }

  async getDecisionById(id: string) {
    const decision = await prisma.decision.findUnique({ where: { id } });
    if (!decision) throw new Error("Không tìm thấy quyết định");
    return {
      ...decision,
      basedOn: decision.basedOnJson ? JSON.parse(decision.basedOnJson) : [],
    };
  }

  async getAllDecisions() {
    const decisions = await prisma.decision.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: "desc" },
    });

    return decisions.map((d) => ({
      ...d,
      basedOn: d.basedOnJson ? JSON.parse(d.basedOnJson) : [],
    }));
  }

  async updateDecision(id: string, data: any) {
    const existing = await prisma.decision.findUnique({ where: { id } });
    if (!existing) throw new Error("Không tìm thấy quyết định");

    const updated = await prisma.decision.update({
      where: { id },
      data: {
        decisionName: data.decisionName,
        decisionTitle: data.decisionTitle,
        decisionDate: data.decisionDate ? new Date(data.decisionDate) : undefined,
        basedOnJson: data.basedOn ? JSON.stringify(data.basedOn) : undefined,
        proposal: data.proposal,
        content: data.content,
        draftFile: data.draftFile,
        finalFile: data.finalFile,
        decisionURL: data.decisionURL,
        semesterId: data.semesterId,
      },
    });

    return {
      ...updated,
      basedOn: updated.basedOnJson ? JSON.parse(updated.basedOnJson) : [],
    };
  }

  async deleteDecision(id: string) {
    const deleted = await prisma.decision.update({
      where: { id },
      data: { isDeleted: true },
    });
    return deleted;
  }
}
