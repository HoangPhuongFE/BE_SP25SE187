import { z } from "zod";

export const createThesisAssignmentSchema = z.object({
  decisionName: z.string().min(1, "Số quyết định không được để trống"),
  decisionTitle: z.string().optional(),
  decisionDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: "Ngày ký phải là định dạng ngày hợp lệ",
  }),
  type: z.enum(["DRAFT", "FINAL"]).optional(), // Nếu dùng Enum
  decisionURL: z.string().optional(),

});

export const updateThesisAssignmentSchema = createThesisAssignmentSchema.partial();