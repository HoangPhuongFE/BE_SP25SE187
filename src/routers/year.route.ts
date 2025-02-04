import express from "express";
import { YearController } from "../controller/year.controller";

const router = express.Router();
const yearController = new YearController();

router.get("/", yearController.getAllYears.bind(yearController));
router.post("/", yearController.createYear.bind(yearController));
router.put("/:id", yearController.updateYear.bind(yearController));
router.delete("/:id", yearController.deleteYear.bind(yearController));

export default router;
