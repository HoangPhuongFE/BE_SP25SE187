import { Router } from "express";
import { SubmissionPeriodController } from "../controller/submissionPeriod.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = Router();
const controller = new SubmissionPeriodController();

router.post("/", authenticateToken, checkRole(["admin", "graduation_thesis_manager", "academic_officer"]), controller.createSubmissionPeriod.bind(controller));
router.put("/:periodId", authenticateToken, checkRole(["admin", "graduation_thesis_manager", "academic_officer"]), controller.updateSubmissionPeriod.bind(controller));
router.get("/semester/:semesterId", authenticateToken, controller.getSubmissionPeriods.bind(controller));
router.get("/:periodId", authenticateToken, controller.getSubmissionPeriodById.bind(controller));
router.delete("/:periodId", authenticateToken, checkRole(["admin", "graduation_thesis_manager", "academic_officer"]), controller.deleteSubmissionPeriod.bind(controller));

export default router;
