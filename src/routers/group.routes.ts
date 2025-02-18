import { Router } from "express";
import { GroupController } from "../controller/group.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = Router();
const groupController = new GroupController();

//  Tạo nhóm: Leader, Mentor, Admin, Sinh viên có thể tạo nhóm
router.post("/create", authenticateToken, checkRole(["leader", "admin", "mentor", "student"]), groupController.createGroup.bind(groupController));

// Mời thành viên: Chỉ Leader hoặc Mentor có thể mời
router.post("/invite", authenticateToken, checkRole(["leader", "mentor"]), groupController.inviteMember.bind(groupController));

// Phản hồi lời mời: Chỉ Sinh viên có thể phản hồi lời mời
router.post("/respond", authenticateToken, checkRole(["student"]), groupController.respondToInvitation.bind(groupController));

//  Lấy thông tin nhóm: Chỉ Admin, Manager hoặc Mentor có thể xem
router.get("/info/:groupId", authenticateToken, checkRole(["admin", "graduation_thesis_manager", "mentor"]), groupController.getGroupInfo.bind(groupController));

//  Link chấp nhận lời mời (không yêu cầu token)
router.get("/accept-invitation/:invitationId", groupController.acceptInvitation.bind(groupController));

//  Lấy danh sách nhóm theo kỳ học (nhiều quyền được phép xem)
router.get("/semester", authenticateToken, checkRole(["leader", "admin", "mentor", "student", "graduation_thesis_manager", "academic_officer"]), groupController.getGroupsBySemester.bind(groupController));

//  Lấy danh sách sinh viên chưa có nhóm
router.get("/students-without-group/:semesterId", authenticateToken, checkRole(["admin", "graduation_thesis_manager", "academic_officer"]), groupController.getStudentsWithoutGroup.bind(groupController));

//  Random nhóm: Chỉ Admin hoặc Manager có quyền
router.post("/randomize", authenticateToken, checkRole(["admin", "graduation_thesis_manager"]), groupController.randomizeGroups.bind(groupController));

//  Đổi Leader: Chỉ Leader hoặc Admin có quyền
router.post("/change-leader", authenticateToken, checkRole(["leader", "admin"]), groupController.changeLeader.bind(groupController));

//  Thêm Mentor vào nhóm: Chỉ Admin có quyền
router.post("/add-mentor", authenticateToken, checkRole(["admin"]), groupController.addMentorToGroup.bind(groupController));

//  Xóa thành viên khỏi nhóm: Chỉ Leader, Mentor hoặc Admin có quyền
router.post("/remove-member", authenticateToken, checkRole(["leader", "mentor", "admin"]), groupController.removeMemberFromGroup.bind(groupController));

// Xóa nhóm: Chỉ Leader, Mentor hoặc Admin có quyền
router.delete("/delete/:groupId", authenticateToken, checkRole(["leader", "mentor", "admin"]), groupController.deleteGroup.bind(groupController));

export default router;
