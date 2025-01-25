import express from "express";
import { getAllYears, createYear, updateYear, deleteYear } from "../controller/year.controller";

const router = express.Router();

router.get("/", getAllYears);
router.post("/", createYear);
router.put("/:id", updateYear);
router.delete("/:id", deleteYear);

export default router;
