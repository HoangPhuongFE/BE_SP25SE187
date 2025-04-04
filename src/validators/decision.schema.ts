// 📁 src/validators/decision.schema.ts

import { z } from "zod";

export const createDecisionSchema = z.object({
  decisionName: z.string().min(1, "Số quyết định không được để trống"),
  decisionTitle: z.string().optional(),
  decisionDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: "Ngày ký phải là định dạng ngày hợp lệ",
  }),
  basedOn: z.array(z.string()).optional(),
  participants: z.string().optional(),
  clauses: z.array(z.string()).optional(),
  proposal: z.string().optional(),
  content: z.string().optional(),
  draftFile: z.string().optional(),
  finalFile: z.string().optional(),
  decisionURL: z.string().optional(),
  semesterId: z.string().optional(),
  signature: z.string().optional(),
  type: z.enum(["DRAFT", "FINAL"]).optional(), // Nếu dùng Enum
  // type: z.string().optional(), // Nếu dùng String
});

export const updateDecisionSchema = createDecisionSchema.partial();