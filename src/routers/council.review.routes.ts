import { Router } from 'express';
import { CouncilReviewController } from '../controller/council.review.controller';
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const router = Router();
const councilReviewController = new CouncilReviewController();

// Tạo hội đồng xét duyệt
router.post(
  '/',
  authenticateToken,
  checkRole(["examination_officer", "academic_officer", "graduation_thesis_manager"]),
  councilReviewController.createCouncil.bind(councilReviewController)
);

// Lấy danh sách hội đồng xét duyệt
router.get(
  '/',
  authenticateToken,
  checkRole(["examination_officer", "graduation_thesis_manager", "lecturer", "council_member"]),
  councilReviewController.getCouncils.bind(councilReviewController)
);

// Lấy chi tiết hội đồng xét duyệt theo id
router.get(
  '/:id',
  authenticateToken,
  checkRole(["examination_officer", "graduation_thesis_manager", "lecturer", "council_member"]),
  councilReviewController.getCouncilById.bind(councilReviewController)
);

// Cập nhật hội đồng xét duyệt
router.put(
  '/:id',
  authenticateToken,
  checkRole(["examination_officer", "graduation_thesis_manager"]),
  councilReviewController.updateCouncil.bind(councilReviewController)
);

// Xóa hội đồng xét duyệt
router.put(
  '/:id/delete',
  authenticateToken,
  checkRole(['examination_officer', 'graduation_thesis_manager']),
  councilReviewController.deleteCouncil.bind(councilReviewController)
);

// Thêm thành viên vào hội đồng
router.post(
  "/:councilId/members",
  authenticateToken,
  checkRole(["examination_officer", "graduation_thesis_manager"]),
  councilReviewController.addMemberToCouncil.bind(councilReviewController)
);

// Xóa thành viên khỏi hội đồng
router.delete(
  "/council/:councilId/user/:userId",
  authenticateToken,
  checkRole(["examination_officer", "graduation_thesis_manager"]),
  councilReviewController.removeMemberFromCouncil.bind(councilReviewController)
);

// Lấy chi tiết hội đồng cho giảng viên
router.get(
  '/lecturers/councils/:id',
  authenticateToken,
  checkRole(['lecturer', 'council_member']),
  councilReviewController.getCouncilDetailsForLecturer.bind(councilReviewController)
);

// Tạo lịch chấm điểm
router.post(
  '/schedules',
  authenticateToken,
  checkRole(['examination_officer', 'graduation_thesis_manager']),
  councilReviewController.createReviewSchedule.bind(councilReviewController)
);

// API cho mentor xem lịch nhóm
router.get(
  '/mentor/schedules',
  authenticateToken,
  checkRole(['lecturer']), 
  councilReviewController.getReviewScheduleForMentor.bind(councilReviewController)
);

// API cho student xem lịch nhóm
router.get(
  '/student/schedules',
  authenticateToken,
  checkRole(['student'],false),
  councilReviewController.getReviewScheduleForStudent.bind(councilReviewController)
);

export default router;