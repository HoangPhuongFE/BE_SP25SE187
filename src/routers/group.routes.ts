import { Router } from "express";
import { GroupController } from "../controller/group.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";
import { checkGroupMembership, checkLeaderOrMentor, checkAdmin } from "../middleware/group.middleware";

const router = Router();
const groupController = new GroupController();

// Tạo nhóm: Leader/mentor/admin có thể tạo nhóm
router.post("/create", authenticateToken, checkRole(["leader", "admin", "mentor","student"]), groupController.createGroup.bind(groupController));

// Mời thành viên: Yêu cầu người dùng là leader hoặc mentor của nhóm
router.post("/invite", authenticateToken, checkLeaderOrMentor, groupController.inviteMember.bind(groupController));

// Phản hồi lời mời: Sinh viên phản hồi lời mời (đã được bảo vệ bởi authenticateToken & checkRole nếu cần)
router.post("/respond", authenticateToken, checkRole(["student"]), groupController.respondToInvitation.bind(groupController));

// Lấy thông tin nhóm: Yêu cầu người dùng phải thuộc nhóm
router.get("/info/:groupId", authenticateToken, checkGroupMembership,checkRole(["admin","graduation_thesis_manager","mentor"]), groupController.getGroupInfo.bind(groupController));

// Link chấp nhận lời mời (không yêu cầu token)
router.get("/accept-invitation/:invitationId", groupController.acceptInvitation.bind(groupController));

// Lấy danh sách nhóm theo kỳ học (Admin, leader, mentor, sinh viên, ...)
router.get("/semester", authenticateToken, checkRole(["leader", "admin", "mentor", "student", "graduation_thesis_manager", "academic_officer"]), groupController.getGroupsBySemester.bind(groupController));

// Lấy danh sách sinh viên chưa có nhóm (Admin, graduation_thesis_manager, academic_officer, v.v.)
router.get("/students-without-group/:semesterId", authenticateToken, checkRole(["leader", "admin", "mentor", "student", "graduation_thesis_manager", "academic_officer"]), groupController.getStudentsWithoutGroup.bind(groupController));

// Random nhóm: Chỉ admin hoặc graduation_thesis_manager
router.post("/randomize", authenticateToken, checkRole(["admin", "graduation_thesis_manager"]), groupController.randomizeGroups.bind(groupController));

// Đổi leader: Yêu cầu authenticateToken, có thể thêm checkLeaderOrMentor nếu cần
router.post("/change-leader", authenticateToken,checkLeaderOrMentor, groupController.changeLeader.bind(groupController));


// Thêm mentor: Chỉ admin có thể thêm mentor vào nhóm
router.post("/add-mentor", authenticateToken, checkAdmin, groupController.addMentorToGroup.bind(groupController));

export default router;
