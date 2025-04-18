import { Router } from "express";
import { SubmissionPeriodController } from "../controllers/submissionPeriod.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = Router();
const controller = new SubmissionPeriodController();

router.post("/", authenticateToken, checkRole(["graduation_thesis_manager", "examination_officer"]), controller.createSubmissionPeriod.bind(controller));
router.put("/:periodId", authenticateToken, checkRole([ "graduation_thesis_manager", "examination_officer"]), controller.updateSubmissionPeriod.bind(controller));
router.get("/semester/:semesterId", authenticateToken, checkRole(["graduation_thesis_manager", "examination_officer",'lecturer','student']), controller.getSubmissionPeriods.bind(controller));
router.get("/:periodId", authenticateToken,checkRole(["graduation_thesis_manager", "examination_officer",'lecturer','student']), controller.getSubmissionPeriodById.bind(controller));
router.put(
    '/:periodId/delete', 
    authenticateToken,
    checkRole(['graduation_thesis_manager', 'examination_officer']),
    controller.deleteSubmissionPeriod.bind(controller)
  );
export default router;
