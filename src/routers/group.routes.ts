import { Router } from "express";
import { GroupController } from "../controller/group.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";
import { checkSemester } from "../middleware/checkSemester";

const router = Router();
const groupController = new GroupController();

// 1️ Tạo nhóm
router.post(
  "/create",
  authenticateToken,
  checkRole(["leader", "admin", "mentor", "student"]),
  groupController.createGroup.bind(groupController)
);

// 2️ Mời thành viên
router.post(
  "/invite",
  authenticateToken,
  checkRole(["student", "admin"]),
  checkSemester, 
  groupController.inviteMember.bind(groupController)
);

// 3️ Phản hồi lời mời
router.post(
  "/respond",
  authenticateToken,
  checkRole(["student"]),
  groupController.respondToInvitation.bind(groupController)
);

// 4️ Lấy thông tin nhóm
router.get(
  "/info/:groupId",
  authenticateToken,
  checkRole(["admin", "graduation_thesis_manager", "mentor", "examination_officer", "student"]),
  groupController.getGroupInfo.bind(groupController)
);

// 5️ Lấy DS nhóm theo kỳ
router.get(
  "/semester",
  authenticateToken,
  checkRole(["leader", "admin", "mentor", "student", "graduation_thesis_manager", "academic_officer"]),
  groupController.getGroupsBySemester.bind(groupController)
);

// 6️ Đổi Leader
router.post(
  "/change-leader",
  authenticateToken,
  checkRole(["leader", "admin", "student"]),
  checkSemester, 
  groupController.changeLeader.bind(groupController)
);

// 7️ Thêm Mentor
router.post(
  "/add-mentor",
  authenticateToken,
  checkRole(["admin", "graduation_thesis_manager", "academic_officer"]),
  checkSemester,
  groupController.addMentorToGroup.bind(groupController)
);

// 8️ Xóa thành viên
router.post(
  "/remove-member",
  authenticateToken,
  checkRole(["leader", "mentor", "admin", "student"]),
  checkSemester,
  groupController.removeMemberFromGroup.bind(groupController)
);

// 9️ Xóa nhóm
router.delete( 
  "/delete/:groupId",
    authenticateToken,
  checkRole(["leader", "student", "mentor", "admin", "graduation_thesis_manager", "academic_officer"]),
  checkSemester, 
  groupController.deleteGroup.bind(groupController)
);

// 10️ Rời nhóm
router.post(
  "/leave",
  authenticateToken,
  checkRole(["student", "mentor", "admin"]),
  checkSemester, 
  groupController.leaveGroup.bind(groupController)
);

// 11️ Hủy lời mời
router.post(
  "/cancel-invitation",
  authenticateToken,
  checkRole(["student", "mentor", "admin"]),
  checkSemester, 
  groupController.cancelInvitation.bind(groupController)
);

// 12️ Khóa nhóm
router.post(
  "/lock",
  authenticateToken,
  checkRole(["mentor", "admin"]),
  groupController.lockGroup.bind(groupController)
);

// 13️ Mở khóa nhóm
router.put(
  "/unlock-group",
  authenticateToken,
  checkRole(["admin", "academic_officer"]),
  groupController.unlockGroup.bind(groupController)
);

//  14️ Lấy danh sách thành viên nhóm mới thêm
router.get(
  "/members/:groupId",
  authenticateToken,
  checkRole(["leader", "admin"]),
  groupController.getGroupMembers.bind(groupController)
);

//  15️ Lấy danh sách mentor trong nhóm mới thêm
router.get(
  "/mentors/:groupId",
  authenticateToken,
  checkRole(["leader", "admin", "mentor"]),
  groupController.getGroupMentors.bind(groupController)
);

//  16️ Lấy danh sách sinh viên chưa có nhóm mới thêm
router.get(
  "/students-without-group/:semesterId",
  authenticateToken,
  checkRole(["admin", "graduation_thesis_manager", "academic_officer"]),
  groupController.getStudentsWithoutGroup.bind(groupController)
);

//  17️ Random nhóm mới thêm
router.post(
  "/randomize",
  authenticateToken,
  checkRole(["admin", "graduation_thesis_manager", "academic_officer"]),
  groupController.randomizeGroups.bind(groupController)
);

// 18️ Thay đổi Mentor mới thêm
router.put(
  "/change-mentor",
  authenticateToken,
  checkRole(["admin", "mentor"]),
  checkSemester,
  groupController.updateMentor.bind(groupController)
);


router.get(
"/accept-invitation/:invitationId",
  groupController.acceptInvitation.bind(groupController)
);
export default router;
