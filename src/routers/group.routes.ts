import { Router } from "express";
import { GroupController } from "../controller/group.controller";
import { authenticateToken } from "../middleware/user.middleware";

const router = Router();
const groupController = new GroupController();

router.post("/create", authenticateToken, groupController.createGroup.bind(groupController));

router.post("/invite", authenticateToken, groupController.inviteMember.bind(groupController));

router.post("/respond", authenticateToken, groupController.respondToInvitation.bind(groupController));

router.get("/:groupId", authenticateToken, groupController.getGroupInfo.bind(groupController));

router.get("/accept-invitation/:invitationId", groupController.acceptInvitation.bind(groupController));


export default router;
