import { Request, Response } from "express";
import { GroupService } from "../service/group.service";
import { AuthenticatedRequest } from "../middleware/user.middleware";

const groupService = new GroupService();

export class GroupController {
  async createGroup(req: AuthenticatedRequest, res: Response) {
    try {
      const { semesterId } = req.body;
      const result = await groupService.createGroup(req.user!.userId, semesterId);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }

  async inviteMember(req: AuthenticatedRequest, res: Response) {
    try {
      const { groupId, studentId } = req.body;
      const result = await groupService.inviteMember(groupId, studentId, req.user!.userId);
      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async respondToInvitation(req: AuthenticatedRequest, res: Response) {
    try {
      const { invitationId, response } = req.body;
      const result = await groupService.respondToInvitation(invitationId, req.user!.userId, response);
      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }


}

