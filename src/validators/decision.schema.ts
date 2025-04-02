import { z } from "zod";

export const createDecisionSchema = z.object({
  decisionName: z.string().min(1),
  decisionTitle: z.string().optional(),
  decisionDate: z.string().optional(),
  basedOn: z.array(z.string()).optional(),
  proposal: z.string().optional(),
  content: z.string().optional(),
  draftFile: z.string().optional(),
  finalFile: z.string().optional(),
  decisionURL: z.string().optional(),
  semesterId: z.string().optional(),
});

export const updateDecisionSchema = createDecisionSchema;
