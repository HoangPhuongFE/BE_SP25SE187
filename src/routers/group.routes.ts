import { Router } from "express";
import { GroupController } from "../controller/group.controller";
import { authenticateToken ,checkRole  } from "../middleware/user.middleware";

const router = Router();
const groupController = new GroupController();

router.post("/create", authenticateToken, checkRole (["leader", "admin", "mentor","student"]), 
groupController.createGroup.bind(groupController));

router.post("/invite", authenticateToken, checkRole (["leader", "admin", "mentor","student"]),
groupController.inviteMember.bind(groupController));

router.post("/respond", authenticateToken, checkRole (["leader", "admin", "mentor","student"]),
groupController.respondToInvitation.bind(groupController));

router.get("/:groupId", authenticateToken,
     groupController.getGroupInfo.bind(groupController));

router.get("/accept-invitation/:invitationId", 
    groupController.acceptInvitation.bind(groupController));

router.get("/:semesterId", authenticateToken, 
    checkRole (["leader", "admin", "mentor","student","graduation_thesis_manager", "academic_officer"]),
    groupController.getGroupsBySemester.bind(groupController));

router.get("/students-without-group/:semesterId",
    authenticateToken,
    checkRole (["leader", "admin", "mentor","student","graduation_thesis_manager", "academic_officer"]), 
     groupController.getStudentsWithoutGroup.bind(groupController));

router.post(
    "/randomize",
    authenticateToken,
    checkRole(["admin", "graduation_thesis_manager"]),
    groupController.randomizeGroups.bind(groupController)
  );


  
  

export default router;
