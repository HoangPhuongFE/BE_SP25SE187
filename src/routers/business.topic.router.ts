import { Router } from 'express';
import { BusinessTopicController } from '../controllers/businessTopicController';
import {authenticateToken, checkRole  } from '../middleware/user.middleware';
import multer from 'multer'; 

const router = Router();
const businessTopicController = new BusinessTopicController();

const upload = multer({ dest: 'uploads/' }); // Thư mục lưu file tạm
// Định nghĩa route để nhập đề tài từ doanh nghiệp
router.post(
  '/import',
    authenticateToken, // Middleware xác thực token
    // Middleware xác thực token và kiểm tra vai trò
  checkRole(["graduation_thesis_manager"]), // Yêu cầu vai trò "graduation_thesis_manager"
    upload.single('file'), // Middleware multer để xử lý file upload
  businessTopicController.importBusinessTopics.bind(businessTopicController)
);

export default router;