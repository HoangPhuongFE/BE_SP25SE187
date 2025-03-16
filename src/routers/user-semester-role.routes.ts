// routes/semester-role.routes.ts
import { Router } from 'express';
import { SemesterRoleController } from '../controller/user-semester-role.controller';
import { authenticateToken ,checkRole } from '../middleware/user.middleware';

const router = Router();
const semesterRoleController = new SemesterRoleController();

router.get(
  '/',
  authenticateToken,
  checkRole(['admin', 'academic_officer',"graduation_thesis_manager", "examination_officer",'mentor','lecturer']),
  semesterRoleController.getRolesBySemester.bind(semesterRoleController)
);

router.post(
  '/',
  authenticateToken,
  checkRole(['admin','academic_officer',"graduation_thesis_manager", "examination_officer"]),
  semesterRoleController.createSemesterRole.bind(semesterRoleController)
);

router.put(
  '/',
  authenticateToken,
  checkRole(['admin','academic_officer',"graduation_thesis_manager", "examination_officer"]),
  semesterRoleController.updateSemesterRole.bind(semesterRoleController)
);

router.delete(
  '/:userId/:roleId/:semesterId',
  authenticateToken,
  checkRole(['admin','academic_officer',"graduation_thesis_manager", "examination_officer"]),
  semesterRoleController.deleteSemesterRole.bind(semesterRoleController)
);

export default router;
