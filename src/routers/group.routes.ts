import { Router } from "express";
import { GroupController } from "../controller/group.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = Router();
const groupController = new GroupController();

// 1) Tạo nhóm
router.post(
  "/create",
  authenticateToken,
  checkRole(["leader", "admin", "mentor", "student"]),
  groupController.createGroup.bind(groupController)
);

// 2) Mời thành viên
router.post(
  "/invite",
  authenticateToken,
  checkRole(["student", "admin"]),
  groupController.inviteMember.bind(groupController)
);

// 3) Phản hồi lời mời
router.post(
  "/respond",
  authenticateToken,
  checkRole(["student"]),
  groupController.respondToInvitation.bind(groupController)
);

// 4) Lấy thông tin nhóm
router.get(
  "/info/:groupId",
  authenticateToken,
  checkRole(["admin", "graduation_thesis_manager", "mentor", "examination_officer", "student"]),
  groupController.getGroupInfo.bind(groupController)
);

// 4b) Link chấp nhận lời mời (không yêu cầu token)
router.get("/accept-invitation/:invitationId", groupController.acceptInvitation.bind(groupController));

// 5) Lấy DS nhóm theo kỳ
router.get(
  "/semester",
  authenticateToken,
  checkRole([
    "leader",
    "admin",
    "mentor",
    "student",
    "graduation_thesis_manager",
    "academic_officer",
  ]),
  groupController.getGroupsBySemester.bind(groupController)
);

// 6) Lấy DS sinh viên chưa có nhóm
router.get(
  "/students-without-group/:semesterId",
  authenticateToken,
  checkRole(["admin", "graduation_thesis_manager", "academic_officer"]),
  groupController.getStudentsWithoutGroup.bind(groupController)
);

// 7) Random nhóm
router.post(
  "/randomize",
  authenticateToken,
  checkRole(["admin", "graduation_thesis_manager", "academic_officer"]),
  groupController.randomizeGroups.bind(groupController)
);

// 8) Đổi Leader
router.post(
  "/change-leader",
  authenticateToken,
  checkRole(["leader", "admin","student"]),
  groupController.changeLeader.bind(groupController)
);

// 9) Thêm Mentor
router.post(
  "/add-mentor",
  authenticateToken,
  checkRole(["admin", "graduation_thesis_manager", "academic_officer"]),
    groupController.addMentorToGroup.bind(groupController)
);

// 10) Xóa thành viên
router.post(
  "/remove-member",
  authenticateToken,
  checkRole(["leader", "mentor", "admin","student"]),
  groupController.removeMemberFromGroup.bind(groupController)
);

// 11) Xóa nhóm
router.delete(
  "/delete/:groupId",
  authenticateToken,
  checkRole([
    "leader",
    "student",
    "mentor",
    "admin",
    "graduation_thesis_manager",
    "academic_officer",
  ]),
  groupController.deleteGroup.bind(groupController)
);


// 12) Rời nhóm
router.post(
  "/leave",
  authenticateToken,
  checkRole(["student","mentor","admin"]), 
  groupController.leaveGroup.bind(groupController)
);

// 13) Hủy lời mời
router.post(
  "/cancel-invitation",
  authenticateToken,
  checkRole(["student","mentor","admin"]), 
  groupController.cancelInvitation.bind(groupController)
);

// 14) Lấy danh sách nhóm mà user đã tham gia 
router.get(
  "/:groupId/invitations",
  authenticateToken,
  checkRole(["student","mentor","admin"]),
  groupController.listGroupInvitations.bind(groupController)
);


// 15) Khóa nhóm
router.post(
  "/lock",
  authenticateToken,
  checkRole(["student","mentor","admin"]),
  groupController.lockGroup.bind(groupController)
);




// 17) Lấy danh sách thành viên trong nhóm
router.get(
  "/:groupId/members",
  authenticateToken,
  checkRole(["student","mentor","admin"]),
  groupController.getGroupMembers.bind(groupController)
);

router.put(
  "/change-mentor",
  authenticateToken,
  checkRole(["student","mentor","admin"]),
  groupController.updateMentor.bind(groupController)
);










export default router;
