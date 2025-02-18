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

  async getGroupInfo(req: AuthenticatedRequest, res: Response) {
    try {
      const { groupId } = req.params;
      const groupData = await groupService.getGroupInfo(groupId);
      if (!groupData) {
        return res.status(404).json({ message: "Không tìm thấy nhóm" });
      }
      return res.json(groupData);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }

  async acceptInvitation(req: Request, res: Response) {
    try {
      const { invitationId } = req.params;
      const invitation = await groupService.getInvitationById(invitationId);
      if (!invitation) {
        return res.status(404).send(`<h2>hihi</h2> Lời mời không tồn tại hoặc đã hết hạn.`);
      }

      const result = await groupService.forceAcceptInvitation(invitationId, invitation.studentId, "ACCEPTED");
      return res.send(`<h2>Lời mời đã được chấp nhận!</h2><p>Bạn đã tham gia nhóm thành công.</p>`);
    } catch (error) {
      res.status(400).send(`<h2>Lỗi:</h2> ${(error as Error).message}`);
    }
  }

  async getGroupsBySemester(req: AuthenticatedRequest, res: Response) {
    try {
      const { semesterId } = req.query;
      if (!semesterId) return res.status(400).json({ message: "semesterId là bắt buộc." });

      const groups = await groupService.getGroupsBySemester(semesterId as string, req.user!.userId);
      return res.json({ groups });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }

  async getStudentsWithoutGroup(req: AuthenticatedRequest, res: Response) {
    try {
      const { semesterId } = req.params;
      if (!semesterId) return res.status(400).json({ message: "Thiếu thông tin học kỳ" });

      const students = await groupService.getStudentsWithoutGroup(semesterId);
      return res.json({ data: students });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }

  async randomizeGroups(req: AuthenticatedRequest, res: Response) {
    try {
      const { semesterId } = req.body;
      const result = await groupService.randomizeGroups(semesterId, req.user!.userId);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }

  async changeLeader(req: Request, res: Response) {
    try {
      const { groupId, newLeaderId } = req.body;
      const result = await groupService.changeLeader(groupId, newLeaderId, req.user!.userId);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }

  async addMentorToGroup(req: Request, res: Response) {
    try {
      const { groupId, mentorId } = req.body;
      const userId = req.user!.userId;
      const result = await GroupService.addMentorToGroup(groupId, mentorId, userId);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }
  
  async removeMemberFromGroup(req: Request, res: Response) {
    try {
      const { groupId, memberId } = req.body;
      const result = await groupService.removeMemberFromGroup(groupId, memberId, req.user!.userId);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }

  async deleteGroup(req: Request, res: Response) {
    try {
      const { groupId } = req.params;
      const result = await groupService.deleteGroup(groupId, req.user!.userId);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  }
}