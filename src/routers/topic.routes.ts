import { Router } from 'express';
import { TopicController } from '../controller/topic.controller'; // Đảm bảo đường dẫn đúng
import { authenticateToken, checkRole } from '../middleware/user.middleware';
import upload from '../middleware/upload'; // Middleware để xử lý upload file

const router = Router();
const topicController = new TopicController();

// Tạo đề tài (Mentor hoặc Admin, hỗ trợ upload draftFile)
router.post(
  '/',
  authenticateToken,
  checkRole(['academic_officer', 'admin', 'mentor', 'lecturer', 'graduation_thesis_manager'], false),
  topicController.createTopic.bind(topicController)
);

// Cập nhật đề tài
router.put(
  '/:topicId',
  authenticateToken,
  checkRole(['mentor', 'academic_officer', 'admin', 'graduation_thesis_manager'], false),
  topicController.updateTopic.bind(topicController)
);

// Lấy danh sách đề tài cần duyệt của hội đồng
router.get(
  '/approval',
  authenticateToken,
  checkRole(['admin', 'review', 'lecturer', 'academic_officer', 'graduation_thesis_manager'], false),
  topicController.getTopicsForApprovalBySubmission.bind(topicController)
);

// Lấy danh sách đề tài theo học kỳ
router.get(
  '/semester/:semesterId',
  authenticateToken,
  checkRole(['mentor', 'academic_officer', 'admin', 'graduation_thesis_manager', 'student', 'leader', 'review', 'lecturer'], false),
  topicController.getTopicsBySemester.bind(topicController)
);

// Lấy danh sách đề tài khả dụng cho đăng ký (cho sinh viên)
router.get(
  '/available-topics',
  authenticateToken,
  checkRole(['leader', 'student', 'admin', 'review', 'lecturer', 'academic_officer', 'graduation_thesis_manager'], false),
  topicController.getAvailableTopics.bind(topicController)
);

// Lấy danh sách đề tài đã đăng ký của mentor
router.get(
  '/registered-topics',
  authenticateToken,
  checkRole(['mentor','academic_officer', 'graduation_thesis_manager'], false),
  topicController.getRegisteredTopicsByMentor.bind(topicController)
);

// Lấy chi tiết đề tài theo topicId
router.get(
  '/:topicId',
  authenticateToken,
  checkRole(['mentor', 'academic_officer', 'admin', 'graduation_thesis_manager', 'student', 'leader', 'review', 'lecturer'], false),
  topicController.getTopicById.bind(topicController)
);

// Nhóm trưởng đăng ký đề tài
router.post(
  '/topic-registrations',
  authenticateToken,
  checkRole(['leader', 'student'], false),
  topicController.registerTopic.bind(topicController)
);

// Mentor duyệt đăng ký đề tài
router.put(
  '/topic-registrations/:registrationId/approve',
  authenticateToken,
  checkRole(['mentor'], false),
  topicController.approveTopicRegistrationByMentor.bind(topicController)
);

// Academic Officer duyệt đề tài (hỗ trợ upload finalFile)
router.post(
  '/:topicId/status',
  authenticateToken,
  checkRole(['academic_officer', 'admin', 'graduation_thesis_manager'], false),
  upload.single('finalFile'),
  topicController.approveTopicByAcademic.bind(topicController)
);

// Xóa đề tài
router.delete(
  '/:topicId',
  authenticateToken,
  checkRole(['admin', 'graduation_thesis_manager','academic_officer'], false),
  topicController.deleteTopic.bind(topicController)
);

// Xuất danh sách đề tài cần duyệt ra Excel
router.get(
  '/export',
  authenticateToken,
  checkRole(['admin', 'academic_officer', 'graduation_thesis_manager'], false),
  topicController.exportTopicsForApproval.bind(topicController)
);

// Tải file từ Decision (draftFile hoặc finalFile)
router.get(
  '/decisions/download',
  authenticateToken,
  checkRole(['mentor', 'academic_officer', 'admin', 'graduation_thesis_manager'], false),
  topicController.downloadDecisionFile.bind(topicController)
);

export default router;