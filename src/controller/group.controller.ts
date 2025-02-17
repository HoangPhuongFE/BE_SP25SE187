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
      // Gọi service để lấy thông tin nhóm
      const groupData = await groupService.getGroupInfo(groupId);
      if (!groupData) {
        return res.status(404).json({ message: "Không tìm thấy nhóm" });
      }
      return res.json(groupData);
    } catch (error) {
      return res.status(500).json({ message: (error as Error).message });
    }
  }

  async acceptInvitation(req: Request, res: Response) {
    try {
        const { invitationId } = req.params;

        // Tìm lời mời theo ID
        const invitation = await groupService.getInvitationById(invitationId);
        if (!invitation) {
            return res.status(404).send(`<h2>Lỗi:</h2> Lời mời không tồn tại hoặc đã hết hạn.`);
        }

        // Lấy `studentId` từ lời mời thay vì `req.user`
        const result = await groupService.forceAcceptInvitation(invitationId, invitation.studentId, "ACCEPTED");

        return res.send(`
            <h2>Lời mời đã được chấp nhận!</h2>
            <p>Bạn đã tham gia nhóm thành công. Hãy đăng nhập vào hệ thống để xem chi tiết nhóm.</p>
        `);
    } catch (error) {
        return res.status(400).send(`<h2>Lỗi:</h2> ${(error as Error).message}`);
    }
}


}

