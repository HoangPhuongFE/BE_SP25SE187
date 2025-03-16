import { Router } from "express";
import { SubmissionPeriodController } from "../controller/submissionPeriod.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = Router();
const controller = new SubmissionPeriodController();

router.post("/", authenticateToken, checkRole(["graduation_thesis_manager", "examination_officer"]), controller.createSubmissionPeriod.bind(controller));
router.put("/:periodId", authenticateToken, checkRole([ "graduation_thesis_manager", "examination_officer"]), controller.updateSubmissionPeriod.bind(controller));
router.get("/semester/:semesterId", authenticateToken, checkRole(["graduation_thesis_manager", "examination_officer"]), controller.getSubmissionPeriods.bind(controller));
router.get("/:periodId", authenticateToken,checkRole(["graduation_thesis_manager", "examination_officer"]), controller.getSubmissionPeriodById.bind(controller));
router.delete("/:periodId", authenticateToken, checkRole(["graduation_thesis_manager", "examination_officer"]), controller.deleteSubmissionPeriod.bind(controller));

export default router;
