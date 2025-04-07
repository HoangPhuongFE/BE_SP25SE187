import { Router } from 'express';
import { CouncilDefenseController } from '../controllers/council.defense.controller';
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const router = Router();
const councilDefenseController = new CouncilDefenseController();

// Tạo hội đồng bảo vệ
router.post(
    '/',
    authenticateToken,
    checkRole(["examination_officer", "academic_officer", "graduation_thesis_manager"]),
    councilDefenseController.createDefenseCouncil.bind(councilDefenseController)
);

// Thêm thành viên vào hội đồng bảo vệ
router.post(
    '/:councilId/members',
    authenticateToken,
    checkRole(["examination_officer", "graduation_thesis_manager"]),
    councilDefenseController.addMemberToCouncil.bind(councilDefenseController)
);
// Route mới: Lấy danh sách hội đồng bảo vệ
router.get(
    '/',
    authenticateToken,
    checkRole(["examination_officer", "graduation_thesis_manager", "lecturer", "council_member"]),
    councilDefenseController.getDefenseCouncils.bind(councilDefenseController)
);

// Route mới: Lấy chi tiết hội đồng bảo vệ theo ID
router.get(
    '/:councilId',
    authenticateToken,
    checkRole(["examination_officer", "graduation_thesis_manager", "lecturer", "council_member"]),
    councilDefenseController.getDefenseCouncilById.bind(councilDefenseController)
);
// Tạo lịch bảo vệ (Thêm nhóm vào hội đồng)
router.post(
    '/schedules',
    authenticateToken,
    checkRole(["examination_officer", "graduation_thesis_manager"]),
    councilDefenseController.createDefenseSchedule.bind(councilDefenseController)
);

// Xóa hội đồng bảo vệ
router.put(
    '/:councilId/delete',
    authenticateToken,
    checkRole(["examination_officer", "graduation_thesis_manager"]),
    councilDefenseController.deleteDefenseCouncil.bind(councilDefenseController)
);

// Cập nhật hội đồng bảo vệ
router.put(
    '/:councilId',
    authenticateToken,
    checkRole(["examination_officer", "graduation_thesis_manager"]),
    councilDefenseController.updateDefenseCouncil.bind(councilDefenseController)
);

// Mentor xem danh sách hội đồng bảo vệ của nhóm
router.get(
    '/mentor/schedules',
    authenticateToken,
    checkRole(["lecturer", "mentor_main", "mentor_sub"]),
    councilDefenseController.getDefenseScheduleForMentor.bind(councilDefenseController)
);

// Student xem danh sách hội đồng bảo vệ
router.get(
    '/student/schedules',
    authenticateToken,
    checkRole(["student"], false),
    councilDefenseController.getDefenseScheduleForStudent.bind(councilDefenseController)
);

// Leader nhóm cập nhật URL báo cáo
router.put(
    '/schedules/:scheduleId/add-url',
    authenticateToken,
    checkRole(["student", "leader"], false),
    councilDefenseController.addUrlToDefenseSchedule.bind(councilDefenseController)
);

// Thành viên hội đồng xem chi tiết hội đồng bảo vệ
router.get(
    '/:councilId/details',
    authenticateToken,
    checkRole(["lecturer", "council_member"]),
    councilDefenseController.getDefenseCouncilDetailsForMember.bind(councilDefenseController)
);

// Thành viên hội đồng đánh giá từng sinh viên trong nhóm
router.put(
    '/schedules/:defenseScheduleId/students/:studentId/evaluate',
    authenticateToken,
    checkRole(["lecturer", "council_secretary", "council_chairman"
    ]),
    councilDefenseController.evaluateDefenseMember.bind(councilDefenseController)
);
// Route mới: Thay đổi thành viên hội đồng
router.put(
    '/council/:councilId/members',
    authenticateToken,
    checkRole(["examination_officer", "graduation_thesis_manager"]),
    councilDefenseController.updateDefenseCouncilMembers.bind(councilDefenseController)
);

router.delete(
    '/council/:councilId/user/:userId',
    authenticateToken,
    checkRole(["examination_officer", "graduation_thesis_manager"]),
    councilDefenseController.removeCouncilMember.bind(councilDefenseController)
);
// Cập nhật trạng thái và ghi chú của lịch bảo vệ
router.put(
    '/schedules/:scheduleId/update',
    authenticateToken,
    checkRole(["examination_officer", "graduation_thesis_manager", "lecturer", "council_member"]),
    councilDefenseController.updateDefenseScheduleStatus.bind(councilDefenseController)
  );
  
export default router;