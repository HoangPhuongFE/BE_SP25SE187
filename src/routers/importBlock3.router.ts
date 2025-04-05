import express from 'express';
import multer from 'multer';
import { ImportBlock3Controller } from '../controllers/importBlock3.controller'; // Đường dẫn đến controller
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const upload = multer({ dest: 'uploads/' }); // Cấu hình multer để lưu file tạm thời
const router = express.Router();
const importBlock3Controller = new ImportBlock3Controller(); // Đổi tên biến cho phù hợp

// Định nghĩa endpoint: POST /import-block3
router.post(
  '/import-block3',
  authenticateToken, // Middleware xác thực token
  checkRole(['academic_officer', 'graduation_thesis_manager', 'lecture', 'council_member']), // Middleware kiểm tra quyền
  upload.single('file'), // Middleware để xử lý file upload với key là 'file'
  importBlock3Controller.importBlock3Handler.bind(importBlock3Controller) // Gọi phương thức trên instance
);

export default router;