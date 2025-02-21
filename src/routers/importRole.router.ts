import express from "express";
import multer from "multer";
import { ImportRoleController } from "../controller/importRole.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = express.Router();
const importRoleController = new ImportRoleController();
const upload = multer({ dest: "uploads/" }); 

router.post(
  "/roles",
  authenticateToken,
  checkRole(["admin"]),
  upload.single("file"),
  importRoleController.importRoles.bind(importRoleController)
);

export default router;
