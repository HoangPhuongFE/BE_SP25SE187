import { Router } from "express";
import { GroupController } from "../controller/group.controller";
import { authenticateToken, checkRole } from "../middleware/user.middleware";

const router = Router();
const groupController = new GroupController();

// 1️ Tạo nhóm
router.post(
  "/create",
  authenticateToken,
  checkRole([ "student", "graduation_thesis_manager", "academic_officer"]),
   
  groupController.createGroup.bind(groupController)
);

// 2️ Mời thành viên
router.post(
  "/invite",
  authenticateToken,
  checkRole(["student", "admin","leader", "mentor"]),
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
  checkRole( ["graduation_thesis_manager", "examination_officer", "student", 'lecturer']),
  groupController.getGroupInfo.bind(groupController)
);

// 5️ Lấy DS nhóm theo kỳ
router.get(
  "/semester/:semesterId",
  authenticateToken,
  checkRole([ "student", "graduation_thesis_manager", "academic_officer",'lecturer']),
  groupController.getGroupsBySemester.bind(groupController)
);

// 6️ Đổi Leader
router.post(
  "/change-leader",
  authenticateToken,
  checkRole(["leader", "student"]),
  groupController.changeLeader.bind(groupController)
);

// 7️ Thêm Mentor
router.post(
  "/add-mentor",
  authenticateToken,
  checkRole([ "graduation_thesis_manager", "academic_officer"]),
  groupController.addMentorToGroup.bind(groupController)
);

// 8️ Xóa thành viên
router.post(
  "/remove-member",
  authenticateToken,
  checkRole([ "lecturer", "student", "academic_officer",'graduation_thesis_manager']),
  
  groupController.removeMemberFromGroup.bind(groupController)
);

// 9️ Xóa nhóm
router.put(
  '/delete/:groupId', 
  authenticateToken,
  checkRole(['leader', 'student', 'graduation_thesis_manager', 'academic_officer']),
  groupController.deleteGroup.bind(groupController)
);

// 10️ Rời nhóm
router.post(
  "/leave",
  authenticateToken,
  checkRole(["student"]),
  
  groupController.leaveGroup.bind(groupController)
);

// 11️ Hủy lời mời
router.post(
  "/cancel-invitation",
  authenticateToken,
  checkRole(["student"]),
  
  groupController.cancelInvitation.bind(groupController)
);

// 12️ Khóa nhóm
router.post(
  "/lock",
  authenticateToken,
  checkRole([ "graduation_thesis_manager", "academic_officer"]),
  groupController.lockGroup.bind(groupController)
);

// 13️ Mở khóa nhóm
router.put(
  "/unlock-group",
  authenticateToken,
  checkRole([ "academic_officer"]),
  groupController.unlockGroup.bind(groupController)
);

//  14️ Lấy danh sách thành viên nhóm mới thêm
router.get(
  "/members/:groupId",
  authenticateToken,
  checkRole(["leader", "student", "graduation_thesis_manager", "academic_officer",'member']),
  
  groupController.getGroupMembers.bind(groupController)
);

//  15️ Lấy danh sách mentor trong nhóm mới thêm
router.get(
  "/mentors/:groupId",
  authenticateToken,
  checkRole(["leader", "lecturer", "student", "graduation_thesis_manager", "academic_officer"]),
  
  groupController.getGroupMentors.bind(groupController)
);

//  16️ Lấy danh sách sinh viên chưa có nhóm mới thêm
router.get(
  "/students-without-group/:semesterId",
  authenticateToken,
  checkRole([ "graduation_thesis_manager", "academic_officer", "lecturer",'student']),
 
  groupController.getStudentsWithoutGroup.bind(groupController)
);

//  17️ Random nhóm mới thêm
router.post(
  "/randomize",
  authenticateToken,
  checkRole(["graduation_thesis_manager", "academic_officer"]),
  groupController.randomizeGroups.bind(groupController)
);

// 18️ Thay đổi Mentor mới thêm
router.put(
  "/change-mentor",
  authenticateToken,
  checkRole([ "graduation_thesis_manager", "academic_officer"]),
 
  groupController.updateMentor.bind(groupController)
);


router.get(
"/accept-invitation/:invitationId",
  groupController.acceptInvitation.bind(groupController)
);




// Route tạo nhóm bởi academic_officer
router.post(
  "/create-group-by-academic",
  authenticateToken, // Xác thực token
  groupController.createGroupByAcademicOfficer.bind(groupController)
);

// Trong file router (thêm vào cuối danh sách route)
router.get(
  "/students-without-group",
  authenticateToken, // Xác thực token
  checkRole(["student"],false), // Chỉ cho phép sinh viên truy cập
  groupController.getStudentsWithoutGroupForStudent.bind(groupController)
);


// Mentor thay đổi status của member trong học kì 
router.post(
  "/toggle-member-status",
  authenticateToken, 
  checkRole (["lecturer"]),
  groupController.toggleMemberStatusByMentor.bind(groupController)
);

// routes/group.route.ts
router.get(
  "/my-groups",
  authenticateToken,
  checkRole(["student"], false),
  groupController.getMyGroups.bind(groupController)
);
export default router;
