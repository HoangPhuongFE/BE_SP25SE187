import { Router } from 'express';
import { CouncilReviewController } from '../controller/council.review.controller';
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const router = Router();
const councilReviewController = new CouncilReviewController();

// API 1: Tạo hội đồng xét duyệt 
router.post(
  '/',
  authenticateToken,
  checkRole(["examination_officer", "academic_officer", "graduation_thesis_manager"]),
  councilReviewController.createCouncil.bind(councilReviewController)
);

// API: Lấy danh sách hội đồng xét duyệt 
router.get(
  '/',
  authenticateToken,
  checkRole(["examination_officer", "graduation_thesis_manager", "lecturer", "council_member"]),
  councilReviewController.getCouncils.bind(councilReviewController)
);

// API: Lấy chi tiết hội đồng xét duyệt theo id 
router.get(
  '/:id',
  authenticateToken,
  checkRole(["examination_officer", "graduation_thesis_manager", "lecturer", "council_member"]),
  councilReviewController.getCouncilById.bind(councilReviewController)
);

// API: Cập nhật hội đồng xét duyệt
router.put(
  '/:id',
  authenticateToken,
  checkRole(["examination_officer", "graduation_thesis_manager"]),
  councilReviewController.updateCouncil.bind(councilReviewController)
);

// API: Xóa hội đồng xét duyệt 
router.put(
  '/:id/delete',
  authenticateToken,
  checkRole(['examination_officer', 'graduation_thesis_manager']),
  councilReviewController.deleteCouncil.bind(councilReviewController)
);

// API 2: Thêm thành viên vào hội đồng 
router.post(
  "/:councilId/members",
  authenticateToken,
  checkRole(["examination_officer", "graduation_thesis_manager"]),
  councilReviewController.addMemberToCouncil.bind(councilReviewController)
);

// API: Xóa thành viên khỏi hội đồng 
router.delete(
  "/council/:councilId/user/:userId",
  authenticateToken,
  checkRole(["examination_officer", "graduation_thesis_manager"]),
  councilReviewController.removeMemberFromCouncil.bind(councilReviewController)
);

// API: Lấy chi tiết hội đồng cho giảng viên 
router.get(
  '/lecturers/councils/:id',
  authenticateToken,
  checkRole(['lecturer', 'council_member']),
  councilReviewController.getCouncilDetailsForLecturer.bind(councilReviewController)
);

// API 3: Tạo lịch chấm điểm 
router.post(
  '/schedules',
  authenticateToken,
  checkRole(['examination_officer', 'graduation_thesis_manager']),
  councilReviewController.createReviewSchedule.bind(councilReviewController)
);

// API 4: Mentor xem lịch nhóm (Chỉnh sửa checkRole để hỗ trợ mentor_main, mentor_sub)
router.get(
  '/mentor/schedules',
  authenticateToken,
  checkRole(['lecturer', 'mentor_main', 'mentor_sub']),
  councilReviewController.getReviewScheduleForMentor.bind(councilReviewController)
);

// API 5: Student xem lịch nhóm 
router.get(
  '/student/schedules',
  authenticateToken,
  checkRole(['student'], false),
  councilReviewController.getReviewScheduleForStudent.bind(councilReviewController)
);

// API 6: Leader thêm URL 
router.put(
  '/schedules/:scheduleId/add-url',
  authenticateToken,
  checkRole(['student',"leader"],false),
  councilReviewController.addUrlToReviewSchedule.bind(councilReviewController)
);

// API 7: Hội đồng cập nhật trạng thái, note, điểm số 
router.put(
  '/review-assignments/:assignmentId/update',
  authenticateToken,
  checkRole(['lecturer',"council_member"]),
  councilReviewController.updateReviewAssignment.bind(councilReviewController)
);

// API: Hội đồng cập nhật trạng thái của ReviewSchedule (hỗ trợ groupId hoặc groupCode)
router.put(
  "/schedules/:scheduleId/update",
  authenticateToken,
  checkRole(["lecturer", "council_member"]),
  councilReviewController.updateReviewSchedule.bind(councilReviewController)
);

// Route mới: Mentor xác nhận vòng bảo vệ
router.post(
  "/defense/confirm-defense-round",
  authenticateToken,
  checkRole(["mentor_main", "mentor_sub"]),
  councilReviewController.confirmDefenseRound.bind(councilReviewController)
);

export default router;