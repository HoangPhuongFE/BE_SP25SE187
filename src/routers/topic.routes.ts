import { Router } from 'express';
import { TopicController } from '../controller/topic.controller';
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const router = Router();
const topicController = new TopicController();

// Tạo đề tài
router.post(
  '/',
  authenticateToken,
  checkRole(["academic_officer", "admin", "mentor", "graduation_thesis_manager"]),
  topicController.createTopic.bind(topicController)
);

// Cập nhật đề tài
router.put(
  '/:topicId',
  authenticateToken,
  checkRole(["mentor", "academic_officer", "admin", "graduation_thesis_manager"]),
  topicController.updateTopic.bind(topicController)
);

// Lấy danh sách đề tài theo học kỳ
router.get(
  '/semester/:semesterId',
  authenticateToken,
  topicController.getTopicsBySemester.bind(topicController)
);

// Lấy chi tiết đề tài theo topicId
router.get(
  '/:topicId',
  authenticateToken,
  topicController.getTopicById.bind(topicController)
);

// Lấy danh sách đề tài khả dụng cho đăng ký (cho sinh viên)
router.get(
  '/available-topics',
  authenticateToken,
  topicController.getAvailableTopics.bind(topicController)
);

// Nhóm trưởng đăng ký đề tài
router.post(
  '/topic-registrations',
  authenticateToken,
  checkRole(["leader", "student"]),
  topicController.registerTopic.bind(topicController)
);


// Lấy danh sách đề tài cần duyệt của hội đồng (theo submissionPeriodId, round, semesterId)
router.get(
  '/approval',
  authenticateToken,
  checkRole(["admin", "review", "lecturer"]),
  topicController.getTopicsForApprovalBySubmission.bind(topicController)
);



router.put(
  '/topic-registrations/:registrationId/approve', // Cập nhật để chấp nhận registrationId như params
  authenticateToken,
  checkRole(["mentor"]), // Chỉ cho phép mentor
  topicController.approveTopicRegistrationByMentor.bind(topicController)
);
// Hội đồng xét duyệt cập nhật trạng thái đề tài
router.put(
  '/:topicId/status',
  authenticateToken,
  checkRole(["admin", "academic_officer", "review", "lecturer", "mentor"]),
  topicController.updateTopicStatus.bind(topicController)
);

// Xóa đề tài
router.delete(
  '/:topicId',
  authenticateToken,
  checkRole(["admin", "graduation_thesis_manager"]),
  topicController.deleteTopic.bind(topicController)
);

export default router;
