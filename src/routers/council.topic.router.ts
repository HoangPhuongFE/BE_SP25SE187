import { Router } from 'express';
import { CouncilTopicController } from '../controllers/council.topic.controller';
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const router = Router();
const councilTopicController = new CouncilTopicController();

// Tạo hội đồng topic (chỉ cho phép admin, academic_officer, graduation_thesis_manager)
router.post(
  '/',
  authenticateToken,
  checkRole(["examination_officer", "academic_officer", "graduation_thesis_manager"]),
  councilTopicController.createCouncil.bind(councilTopicController)
);

// Lấy danh sách hội đồng topic (cho tất cả người dùng đã xác thực)
router.get(
  '/',
  authenticateToken,
  checkRole(["examination_officer",  "graduation_thesis_manager",'lecturer', 'council_member']),
  councilTopicController.getCouncils.bind(councilTopicController)
);

// Lấy chi tiết hội đồng topic theo id (cho tất cả người dùng đã xác thực)
router.get(
  '/:id',
  authenticateToken,
  checkRole(["examination_officer",  "graduation_thesis_manager",'lecturer']),
  councilTopicController.getCouncilById.bind(councilTopicController)
);

// Cập nhật hội đồng topic (chỉ cho phép admin, academic_officer, graduation_thesis_manager)
router.put(
  '/:id',
  authenticateToken,
  checkRole(["examination_officer",  "graduation_thesis_manager"]),
  councilTopicController.updateCouncil.bind(councilTopicController)
);

// Xóa hội đồng topic (chỉ cho phép admin, academic_officer, graduation_thesis_manager)
router.put(
  '/:id/delete', 
  authenticateToken,
  checkRole(['examination_officer', 'graduation_thesis_manager']),
  councilTopicController.deleteCouncil.bind(councilTopicController)
);
// Thêm thành viên vào hội đồng (chỉ  academic_officer, graduation_thesis_manager)
router.post(
  "/members/:councilId",
  authenticateToken,
  checkRole(["examination_officer", "graduation_thesis_manager"]),
  councilTopicController.addMemberToCouncil.bind(councilTopicController)
);

// Xóa thành viên khỏi hội đồng
router.delete(
  "/council/:councilId/user/:userId",
  authenticateToken,
  checkRole(["examination_officer",  "graduation_thesis_manager"]),
  councilTopicController.removeMemberFromCouncil.bind(councilTopicController)
);

// Route mới cho giảng viên
router.get(
  '/lecturers/councils/:id',
  authenticateToken,
  checkRole(['lecturer', 'council_member']),
  councilTopicController.getCouncilDetailsForLecturer.bind(councilTopicController)
);

// Duyệt đề tài bởi thành viên hội đồng
router.put(
  'topics/:topicId/review',
  authenticateToken,
  checkRole(['council_member',"lecturer", "graduation_thesis_manager"]),
  councilTopicController.reviewTopicByCouncilMember.bind(councilTopicController)

);
export default router;
