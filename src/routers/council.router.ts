import { Router } from 'express';
import { CouncilController } from '../controller/council.controller';
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = Router();
const councilController = new CouncilController(); // Khởi tạo instance của Controller

// 1) Tạo hội đồng
router.post('/', 
  [authenticateToken, checkRole(["admin", "graduation_thesis_manager", "academic_officer"])],
  councilController.createCouncil.bind(councilController)
);

// 2) Thêm thành viên vào hội đồng
router.post('/:councilId/members',
  authenticateToken,
  checkRole(["admin", "graduation_thesis_manager", "academic_officer"]),
  councilController.addMembers.bind(councilController)
);

// 3) Lấy danh sách hội đồng (filter theo semesterId, type)
router.get('/',
  authenticateToken,
  checkRole(["admin", "graduation_thesis_manager", "academic_officer"]),
  councilController.getCouncils.bind(councilController)
);

// 4) Lấy danh sách giảng viên + vai trò của họ trong học kỳ
router.get(
  '/:semesterId/lecturers/roles',
  authenticateToken,
  checkRole(["admin", "graduation_thesis_manager", "mentor", "academic_officer"]),
  councilController.getLecturersRolesInSemester.bind(councilController)
);

router.delete(
  '/:councilId/members/:userId',
  authenticateToken,
  checkRole(["admin", "graduation_thesis_manager", "academic_officer"]),
  councilController.removeCouncilMember.bind(councilController)
);


export default router;
