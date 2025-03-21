import { Router } from 'express';
import { TopicController } from '../controller/topic.controller'; // Đảm bảo đường dẫn đúng
import { authenticateToken, checkRole } from '../middleware/user.middleware';
import upload from '../middleware/upload'; // Middleware để xử lý upload file

const router = Router();
const topicController = new TopicController();

// 1. Tạo đề tài (Mentor hoặc Admin, hỗ trợ upload draftFile)
router.post(
  '/',
  authenticateToken,
  checkRole(['academic_officer', 'admin', 'lecturer', 'graduation_thesis_manager']),
  topicController.createTopic.bind(topicController)
);

// 2. Cập nhật đề tài
router.put(
  '/:topicId',
  authenticateToken,
  checkRole(['academic_officer', 'admin', 'graduation_thesis_manager', 'lecturer']),
  topicController.updateTopic.bind(topicController)
);

// 3. Lấy danh sách đề tài cần duyệt của hội đồng
router.get(
  '/approval',
  authenticateToken,
  checkRole(['admin', 'review', 'lecturer', 'academic_officer', 'graduation_thesis_manager']),
  topicController.getTopicsForApprovalBySubmission.bind(topicController)
);

// 4. Lấy danh sách đề tài theo học kỳ
router.get(
  '/semester/:semesterId',
  authenticateToken,
  checkRole(['academic_officer', 'graduation_thesis_manager', 'lecturer']),
  topicController.getTopicsBySemester.bind(topicController)
);

// 5. Lấy danh sách đề tài khả dụng cho đăng ký (cho sinh viên)
router.get(
  '/available-topics',
  authenticateToken,
  checkRole(['leader', 'student', 'admin', 'review', 'lecturer', 'academic_officer', 'graduation_thesis_manager']),
  topicController.getAvailableTopics.bind(topicController)
);

// 6. Lấy danh sách đề tài đã đăng ký của mentor
router.get(
  '/registered-topics',
  authenticateToken,
  checkRole(['academic_officer', 'graduation_thesis_manager', 'lecturer']),
  topicController.getRegisteredTopicsByMentor.bind(topicController)
);

// 7. Lấy danh sách đăng ký của academic
router.get(
  '/academic/registrations',
  authenticateToken,
  checkRole(['academic_officer']),
  topicController.getAllRegistrations.bind(topicController)
);



// 9. Các route liên quan đến đăng ký đề tài (các route với prefix cố định)
//    a) Sinh viên đăng ký đề tài
router.post(
  '/topic-registrations',
  authenticateToken,
  checkRole(['leader', 'student']),
  topicController.registerTopic.bind(topicController)
);

//    b) Mentor duyệt đăng ký đề tài
router.put(
  '/topic-registrations/:registrationId/approve',
  authenticateToken,
  checkRole(['lecturer']),
  topicController.approveTopicRegistrationByMentor.bind(topicController)
);

// 10. Các route với parameter ở vị trí đầu tiên (để tránh nhầm lẫn):
//    a) Lấy danh sách đăng ký theo group (đặt trước để không bị nhầm với các route động sau)
router.get(
  '/group/:groupId/registrations',
  authenticateToken,
  checkRole(['academic_officer', 'admin', 'graduation_thesis_manager', 'student', 'leader', 'lecturer']),
  topicController.getGroupRegistrations.bind(topicController)
);

//    b) Lấy danh sách đăng ký theo đề tài
router.get(
  '/topic/:topicId/registrations',
  authenticateToken,
  checkRole(['academic_officer', 'admin', 'graduation_thesis_manager', 'student', 'leader', 'lecturer']),
  topicController.getTopicRegistrations.bind(topicController)
);

//    c) Academic Officer duyệt đề tài (hỗ trợ upload finalFile)
//         Sử dụng route có suffix "/status" để phân biệt với các route khác sử dụng :topicId
router.put(
  '/:topicId/status',
  authenticateToken,
  checkRole(['academic_officer', 'admin', 'graduation_thesis_manager']),
  topicController.approveTopicByAcademic.bind(topicController)
);

//    d) Lấy chi tiết đề tài theo topicId
router.get(
  '/:topicId',
  authenticateToken,
  checkRole(['mentor', 'academic_officer', 'admin', 'graduation_thesis_manager', 'student', 'leader', 'review', 'lecturer']),
  topicController.getTopicById.bind(topicController)
);

//    e) Xóa đề tài
router.delete(
  '/:topicId',
  authenticateToken,
  checkRole(['admin', 'graduation_thesis_manager', 'academic_officer', 'lecturer']),
  topicController.deleteTopic.bind(topicController)
);


// 11. Các route liên quan đến đợt đăng ký đề tài
//    a) Lấy danh sách đợt đăng ký đề tài

router.get(
  '/student/topics/approved',
  authenticateToken,
  checkRole(['student', 'leader', 'member'], false),
  topicController.getApprovedTopicsFortudent.bind(topicController)
);

// Route mới: Tất cả đề tài đã duyệt
router.get(
  '/student/topics/approved/all',
  authenticateToken,
  checkRole(['student', 'leader', 'member'], false),
  topicController.getAllApprovedTopicsForStudent.bind(topicController)
);


router.post('/create-with-mentors',
  authenticateToken,
  checkRole(['academic_officer',  'graduation_thesis_manager']),
  topicController.createTopicWithMentors.bind(topicController));

//  gán mentor hoặc nhóm vào đề tài
router.post(
  '/:topicId/assign',
  authenticateToken,
  checkRole(['academic_officer', 'graduation_thesis_manager']),
  topicController.assignMentorsOrGroup
);



export default router;
