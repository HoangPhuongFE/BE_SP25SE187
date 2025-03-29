import { Request, Response } from "express";
import { GroupService } from "../service/group.service";
import { AuthenticatedRequest } from "../middleware/user.middleware";
import HTTP_STATUS from '../constants/httpStatus';
import { GROUP_MESSAGE } from "../constants/message";

const groupService = new GroupService();

export class GroupController {
  async createGroup(req: AuthenticatedRequest, res: Response) {
    try {
      const { semesterId } = req.body;
      const result = await groupService.createGroup(req.user!.userId, semesterId);

      return res.status(result.status).json(result);
    } catch (error) {
      console.error(error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: GROUP_MESSAGE.GROUP_CREATION_FAILED
      });
    }
  }




  async inviteMember(req: Request, res: Response) {
    try {
      const { groupId, groupCode, email, studentId } = req.body;

      // Kiểm tra đầu vào: Phải có ít nhất 1 trong 2 (groupId hoặc groupCode) và (email hoặc studentId)
      if ((!groupId && !groupCode) || (!email && !studentId)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Cần cung cấp groupId hoặc groupCode, và email hoặc studentId."
        });
      }

      // Ưu tiên sử dụng groupId nếu có, nếu không có thì dùng groupCode
      const selectedGroupId = groupId ?? null;
      const selectedGroupCode = groupId ? null : groupCode ?? null;

      // Ưu tiên studentId nếu có, nếu không có thì dùng email
      const selectedStudentId = studentId ?? null;
      const selectedEmail = studentId ? null : email ?? null;

      // Log debug để kiểm tra dữ liệu truyền vào service
      //  console.log("DEBUG: inviteMember - selectedGroupId:", selectedGroupId);
      // console.log("DEBUG: inviteMember - selectedGroupCode:", selectedGroupCode);
      // console.log("DEBUG: inviteMember - selectedStudentId:", selectedStudentId);
      // console.log("DEBUG: inviteMember - selectedEmail:", selectedEmail);

      // Gọi service với thông tin đã chọn
      const result = await groupService.inviteMember(
        selectedGroupId,
        selectedGroupCode,
        selectedEmail,
        selectedStudentId,
        req.user!.userId
      );

      return res.status(result.status).json(result);

    } catch (error) {
      console.error("Lỗi khi gửi lời mời:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: GROUP_MESSAGE.INVITATION_FAILED
      });
    }
  }




  async respondToInvitation(req: AuthenticatedRequest, res: Response) {
    try {
      const { invitationId, response } = req.body;

      // Kiểm tra đầu vào hợp lệ
      if (!invitationId || !response || !["ACCEPTED", "REJECTED"].includes(response)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: GROUP_MESSAGE.INVALID_REQUEST
        });
      }

      // Gọi service để xử lý lời mời
      const result = await groupService.respondToInvitation(invitationId, req.user!.userId, response);

      // Trả về phản hồi từ service
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi xử lý lời mời:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: GROUP_MESSAGE.INVITATION_RESPONSE_FAILED
      });
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
      return res.status(500).json({ message: (error as Error).message });
    }
  }

  // Link chấp nhận lời mời (không cần token)
  async acceptInvitation(req: Request, res: Response) {
    try {
      const { invitationId } = req.params;
      const invitation = await groupService.getInvitationById(invitationId);
      if (!invitation) {
        return res
          .status(404)
          .send(`<h2>hihi</h2> Lời mời không tồn tại hoặc đã hết hạn.`);
      }

      const result = await groupService.forceAcceptInvitation(
        invitationId,
        invitation.studentId,
        "ACCEPTED"
      );
      return res.send(
        `<h2>Lời mời đã được chấp nhận!</h2><p>Bạn đã tham gia nhóm thành công.</p>`
      );
    } catch (error) {
      return res.status(400).send(`<h2>Lỗi:</h2> ${(error as Error).message}`);
    }
  }

  async getGroupsBySemester(req: AuthenticatedRequest, res: Response) {
    try {
      const { semesterId } = req.params;
      if (!semesterId) {
        return res.status(400).json({ message: "semesterId là bắt buộc." });
      }
      const groups = await groupService.getGroupsBySemester(
        semesterId as string,
        req.user!.userId
      );
      return res.json({ groups });
    } catch (error) {
      return res.status(500).json({ message: (error as Error).message });
    }
  }

  async getStudentsWithoutGroup(req: AuthenticatedRequest, res: Response) {
    try {
      const { semesterId } = req.params;
      if (!semesterId) {
        return res.status(400).json({ message: "Thiếu thông tin học kỳ" });
      }
      const students = await groupService.getStudentsWithoutGroup(semesterId);
      return res.json({ data: students });
    } catch (error) {
      return res.status(500).json({ message: (error as Error).message });
    }
  }

  async randomizeGroups(req: AuthenticatedRequest, res: Response) {
    try {
      const { semesterId } = req.body;
      const result = await groupService.randomizeGroups(
        semesterId,
        req.user!.userId
      );
      return res.status(201).json(result);
    } catch (error) {
      return res.status(500).json({ message: (error as Error).message });
    }
  }

  // Đổi Leader
  async changeLeader(req: AuthenticatedRequest, res: Response) {
    try {
      const { groupId, groupCode, newLeaderId, newLeaderEmail } = req.body;

      if ((!groupId && !groupCode) || (!newLeaderId && !newLeaderEmail)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Cần cung cấp groupId hoặc groupCode, và newLeaderId hoặc newLeaderEmail."
        });
      }

      const result = await groupService.changeLeader(groupId, groupCode, newLeaderId, newLeaderEmail, req.user!.userId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ message: (error as Error).message });
    }
  }

  // Thêm Mentor
  async addMentorToGroup(req: Request, res: Response) {
    try {
      const { groupId, groupCode, mentorId, mentorEmail } = req.body;

      if ((!groupId && !groupCode) || (!mentorId && !mentorEmail)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Cần cung cấp groupId hoặc groupCode, và mentorId hoặc mentorEmail."
        });
      }

      const result = await groupService.addMentorToGroup(groupId, groupCode, mentorId, mentorEmail, req.user!.userId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  }


  // Controller
  async removeMemberFromGroup(req: Request, res: Response) {
    try {
      const { groupId, memberId } = req.body;
      const result = await groupService.removeMemberFromGroup(groupId, memberId, req.user!.userId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  }



  async getGroupMentors(req: Request, res: Response) {
    try {
      const { groupId } = req.params;
      const result = await groupService.getGroupMentors(groupId);
      return res.json(result);
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  }

  // Xóa nhóm
  async deleteGroup(req: Request, res: Response) {
    try {
      const groupId = req.params.groupId;
      if (!groupId) {
        console.error('GroupId missing in request');
        return res.status(400).json({ message: 'Thiếu groupId.' });
      }
  
      if (!req.user || !req.user.userId) {
        console.error('User not found in request');
        return res.status(401).json({ message: 'Không tìm thấy thông tin người dùng.' });
      }
  
      const userId = req.user.userId;
      const ipAddress = req.ip; // Lấy địa chỉ IP từ request
  
      const result = await groupService.deleteGroup(groupId, userId, ipAddress);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Delete group error:', error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Lỗi server khi đánh dấu xóa nhóm.',
      });
    }
  }


  // Rời nhóm
  async leaveGroup(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await groupService.leaveGroup(req.body.groupId, req.user!.userId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  }

  // Hủy lời mời
  async cancelInvitation(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await groupService.cancelInvitation(req.body.invitationId, req.user!.userId);
      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  // Lấy danh sách nhóm mà user đã tham gia
  async listGroupInvitations(req: AuthenticatedRequest, res: Response) {
    try {
      const { groupId } = req.params;
      const data = await groupService.listGroupInvitations(groupId, req.user!.userId);
      res.json({ invitations: data });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  // Khóa nhóm
  async lockGroup(req: AuthenticatedRequest, res: Response) {
    try {
      const { groupId } = req.body;
      const result = await groupService.lockGroup(groupId, req.user!.userId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  }


  // update mentor
  async updateMentor(req: Request, res: Response) {
    try {
      // console.log(" Debug Body:", req.body);

      const { groupIdOrCode, oldMentorIdOrEmail, newMentorIdOrEmail, newMentorRole, semesterId } = req.body;

      if (!groupIdOrCode || !oldMentorIdOrEmail || !newMentorIdOrEmail || !newMentorRole) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Cần cung cấp groupId hoặc groupCode, oldMentorIdOrEmail, newMentorIdOrEmail và newMentorRole."
        });
      }

      if (!["mentor_main", "mentor_sub"].includes(newMentorRole)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Vai trò mới phải là 'mentor_main' hoặc 'mentor_sub'."
        });
      }

      const result = await groupService.updateMentor(
        groupIdOrCode,
        oldMentorIdOrEmail,
        newMentorIdOrEmail,
        newMentorRole,
        req.user!.userId,
        semesterId
      );

      return res.status(200).json(result);
    } catch (error) {
      //   console.error(" Lỗi updateMentor:", error);
      return res.status(400).json({ message: (error as Error).message });
    }
  }





  // Lấy danh sách thành viên trong nhóm
  async getGroupMembers(req: AuthenticatedRequest, res: Response) {
    try {
      const { groupId } = req.params;
      const data = await groupService.getGroupMembers(groupId, req.user!.userId);
      res.json({ members: data });
    } catch (error) {
      res.status(400).json({ message: (error as Error).message });
    }
  }

  async unlockGroup(req: Request, res: Response) {
    try {
      const { groupId } = req.body;
      const result = await groupService.unlockGroup(groupId, req.user!.userId);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  }


  async createGroupByAcademicOfficer(req: AuthenticatedRequest, res: Response) {
    try {
      // Kiểm tra xem người dùng đã đăng nhập chưa
      if (!req.user || !req.user.userId) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          message: "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn."
        });
      }

      // Lấy dữ liệu từ req.body
      const { leaderEmail, semesterId } = req.body;
      const createdBy = req.user.userId; // Lấy userId từ req.user

      // Kiểm tra các trường bắt buộc
      if (!leaderEmail || !semesterId) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "Email trưởng nhóm, học kỳ là bắt buộc."
        });
      }

      // Tạo đối tượng input cho service
      const input = { leaderEmail, semesterId, createdBy };

      // Gọi service để tạo nhóm
      const result = await groupService.createGroupByAcademicOfficer(input);

      // Trả về kết quả từ service
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi trong createGroupByAcademicOfficerController:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi hệ thống khi tạo nhóm."
      });
    }
  }
  // 
  async getStudentsWithoutGroupForStudent(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await groupService.getStudentsWithoutGroupForStudent(req.user!.userId);
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("Lỗi trong getStudentsWithoutGroupForStudent:", error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Lỗi hệ thống khi lấy danh sách sinh viên chưa có nhóm.",
      });
    }
  }


  async toggleMemberStatusByMentor(req: Request, res: Response) {
    const { groupId, groupCode, memberId, memberEmail, newStatus } = req.body;
    const mentorId = (req as any).user?.userId; // Lấy mentorId từ token qua middleware

    // Kiểm tra dữ liệu đầu vào
    if (!groupId && !groupCode) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Cần cung cấp groupId hoặc groupCode.",
      });
    }
    if (!memberId && !memberEmail) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Cần cung cấp memberId hoặc memberEmail.",
      });
    }
    if (!newStatus || !["ACTIVE", "INACTIVE"].includes(newStatus)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "newStatus phải là 'ACTIVE' hoặc 'INACTIVE'.",
      });
    }
    if (!mentorId) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: "Không thể xác định mentor từ token.",
      });
    }

    try {
      const result = await groupService.toggleMemberStatusByMentor(
        { groupId, groupCode },
        { memberId, memberEmail },
        newStatus,
        mentorId
      );
      return res.status(result.status).json(result);
    } catch (error) {
      console.error("Lỗi controller:", error);
      return res.status(500).json({
        success: false,
        status: 500,
        message: "Lỗi server",
      });
    }
  }
  
  async getMyGroups(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
  
      const groups = await groupService.getMyGroups(userId);
  
      return res.status(200).json({
        message: "Lấy danh sách nhóm thành công.",
        data: groups,
      });
    } catch (error) {
      console.error("Lỗi khi lấy danh sách nhóm:", error);
      return res.status(500).json({ message: (error as Error).message });
    }
  }
  
}
