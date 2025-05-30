import { PrismaClient } from '@prisma/client';
import { nowVN } from '../utils/date'; 

const prisma = new PrismaClient();

export class DecisionService {
  async createDecision(data: any, createdBy: string) {
  const newDecision = await prisma.decision.create({
    data: {
      decisionName: data.decisionName,
      decisionTitle: data.decisionTitle,
      decisionNameA: data.decisionNameA,
      decisionTitleB: data.decisionTitleB,
      decisionDate: data.decisionDate ? new Date(data.decisionDate) : undefined,
      basedOnJson: data.basedOn ? JSON.stringify(data.basedOn) : undefined,
      participantsJson: data.participants ? JSON.stringify(data.participants) : undefined,
      clausesJson: data.clauses ? JSON.stringify(data.clauses) : undefined,
      proposal: data.proposal,
      content: data.content,
      draftFile: data.draftFile,
      finalFile: data.finalFile,
      decisionURL: data.decisionURL,
      semesterId: data.semesterId,
      signature: data.signature,
      type: data.type,
      createdBy,
      createdAt: nowVN(), // Thêm: Rõ ràng gán createdAt bằng nowVN()
    },
  });

  return {
    id: newDecision.id,
    decisionName: newDecision.decisionName,
    decisionTitle: newDecision.decisionTitle,
    decisionNameA: newDecision.decisionNameA,
    decisionTitleB: newDecision.decisionTitleB,
    decisionDate: newDecision.decisionDate,
    proposal: newDecision.proposal,
    content: newDecision.content,
    draftFile: newDecision.draftFile,
    finalFile: newDecision.finalFile,
    decisionURL: newDecision.decisionURL,
    semesterId: newDecision.semesterId,
    createdBy: newDecision.createdBy,
    createdAt: newDecision.createdAt,
    isDeleted: newDecision.isDeleted,
    signature: newDecision.signature,
    type: newDecision.type,
    basedOn: newDecision.basedOnJson ? JSON.parse(newDecision.basedOnJson) : [],
    participants: newDecision.participantsJson ? JSON.parse(newDecision.participantsJson) : null,
    clauses: newDecision.clausesJson ? JSON.parse(newDecision.clausesJson) : [],
  };
}

  async getDecisionById(id: string) {
    const decision = await prisma.decision.findUnique({
      where: { id, isDeleted: false },
    });
    if (!decision) throw new Error("Không tìm thấy quyết định");

    return {
      id: decision.id,
      decisionName: decision.decisionName,
      decisionTitle: decision.decisionTitle,
      decisionNameA: decision.decisionNameA, // Thêm vào response
      decisionTitleB: decision.decisionTitleB, // Thêm vào response
      decisionDate: decision.decisionDate,
      proposal: decision.proposal,
      content: decision.content,
      draftFile: decision.draftFile,
      finalFile: decision.finalFile,
      decisionURL: decision.decisionURL,
      semesterId: decision.semesterId,
      createdBy: decision.createdBy,
      createdAt: decision.createdAt,
      isDeleted: decision.isDeleted,
      signature: decision.signature,
      type: decision.type, // Thêm vào response
      basedOn: decision.basedOnJson ? JSON.parse(decision.basedOnJson) : [],
      participants: decision.participantsJson ? JSON.parse(decision.participantsJson) : null,
      clauses: decision.clausesJson ? JSON.parse(decision.clausesJson) : [],
    };
  }

  async getAllDecisions() {
    const decisions = await prisma.decision.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: "desc" },
    });

    return decisions.map((d) => ({
      id: d.id,
      decisionName: d.decisionName,
      decisionTitle: d.decisionTitle,
      decisionNameA: d.decisionNameA, // Thêm vào response
      decisionTitleB: d.decisionTitleB, // Thêm vào response
      decisionDate: d.decisionDate,
      proposal: d.proposal,
      content: d.content,
      draftFile: d.draftFile,
      finalFile: d.finalFile,
      decisionURL: d.decisionURL,
      semesterId: d.semesterId,
      createdBy: d.createdBy,
      createdAt: d.createdAt,
      isDeleted: d.isDeleted,
      signature: d.signature,
      type: d.type, // Thêm vào response
      basedOn: d.basedOnJson ? JSON.parse(d.basedOnJson) : [],
      participants: d.participantsJson ? JSON.parse(d.participantsJson) : null,
      clauses: d.clausesJson ? JSON.parse(d.clausesJson) : [],
    }));
  }

  async updateDecision(id: string, data: any) {
  const existing = await prisma.decision.findUnique({
    where: { id, isDeleted: false },
  });
  if (!existing) throw new Error("Không tìm thấy quyết định");

  const updated = await prisma.decision.update({
    where: { id },
    data: {
      decisionName: data.decisionName,
      decisionTitle: data.decisionTitle,
      decisionNameA: data.decisionNameA,
      decisionTitleB: data.decisionTitleB,
      decisionDate: data.decisionDate ? new Date(data.decisionDate) : undefined,
      basedOnJson: data.basedOn ? JSON.stringify(data.basedOn) : undefined,
      participantsJson: data.participants ? JSON.stringify(data.participants) : undefined,
      clausesJson: data.clauses ? JSON.stringify(data.clauses) : undefined,
      proposal: data.proposal,
      content: data.content,
      draftFile: data.draftFile,
      finalFile: data.finalFile,
      decisionURL: data.decisionURL,
      semesterId: data.semesterId,
      signature: data.signature,
      type: data.type,
      },
  });

  return {
    id: updated.id,
    decisionName: updated.decisionName,
    decisionTitle: updated.decisionTitle,
    decisionNameA: updated.decisionNameA,
    decisionTitleB: updated.decisionTitleB,
    decisionDate: updated.decisionDate,
    proposal: updated.proposal,
    content: updated.content,
    draftFile: updated.draftFile,
    finalFile: updated.finalFile,
    decisionURL: updated.decisionURL,
    semesterId: updated.semesterId,
    createdBy: updated.createdBy,
    createdAt: updated.createdAt,
    isDeleted: updated.isDeleted,
    signature: updated.signature,
    type: updated.type,
    basedOn: updated.basedOnJson ? JSON.parse(updated.basedOnJson) : [],
    participants: updated.participantsJson ? JSON.parse(updated.participantsJson) : null,
    clauses: updated.clausesJson ? JSON.parse(updated.clausesJson) : [],
  };
}

  async deleteDecision(id: string) {
    const existing = await prisma.decision.findUnique({
      where: { id, isDeleted: false },
    });
    if (!existing) throw new Error("Không tìm thấy quyết định");

    const deleted = await prisma.decision.update({
      where: { id },
      data: { isDeleted: true },
    });

    return {
      id: deleted.id,
      decisionName: deleted.decisionName,
      decisionTitle: deleted.decisionTitle,
      decisionNameA: deleted.decisionNameA, // Thêm vào response
      decisionTitleB: deleted.decisionTitleB, // Thêm vào response
      decisionDate: deleted.decisionDate,
      proposal: deleted.proposal,
      content: deleted.content,
      draftFile: deleted.draftFile,
      finalFile: deleted.finalFile,
      decisionURL: deleted.decisionURL,
      semesterId: deleted.semesterId,
      createdBy: deleted.createdBy,
      createdAt: deleted.createdAt,
      isDeleted: deleted.isDeleted,
      signature: deleted.signature,
      type: deleted.type, // Thêm vào response
      basedOn: deleted.basedOnJson ? JSON.parse(deleted.basedOnJson) : [],
      participants: deleted.participantsJson ? JSON.parse(deleted.participantsJson) : null,
      clauses: deleted.clausesJson ? JSON.parse(deleted.clausesJson) : [],
    };
  }
}