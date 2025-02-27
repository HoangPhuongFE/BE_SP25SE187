import { Router } from 'express'
import { CouncilController } from '../controller/council.controller'
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = Router()

// 1) Tạo hội đồng
router.post('/',authenticateToken,
    checkRole(["admin", "graduation_thesis_manager",'academic_officer']),
     CouncilController.createCouncil)

// 2) Thêm thành viên vào hội đồng
router.post('/:councilId/members',authenticateToken,  checkRole(["admin", "graduation_thesis_manager",'academic_officer']),
CouncilController.addMembers)

// 3) Lấy danh sách hội đồng (filter theo semesterId, type)
router.get('/',authenticateToken, checkRole(["admin", "graduation_thesis_manager",'academic_officer']),
 CouncilController.getCouncils)

// 4) Xem giảng viên + vai trò trong học kỳ
router.get(
  '/:semesterId/lecturers/roles',
  checkRole(["admin", "graduation_thesis_manager", "mentor",'academic_officer']),
  authenticateToken,
  CouncilController.getLecturersRolesInSemester
)

export default router
