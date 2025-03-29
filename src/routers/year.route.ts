import express from "express";
import { YearController } from "../controller/year.controller";
import { authenticateToken } from '../middleware/user.middleware';
const router = express.Router();
const yearController = new YearController();

router.get("/",authenticateToken,yearController.getAllYears.bind(yearController));
router.post("/", authenticateToken,yearController.createYear.bind(yearController));
router.put("/:id",authenticateToken, yearController.updateYear.bind(yearController));
router.put("/:id/delete", authenticateToken,yearController.deleteYear.bind(yearController));

export default router;
