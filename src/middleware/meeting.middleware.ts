import { Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { AuthenticatedRequest } from './user.middleware';
import { MEETING_MESSAGE } from '../constants/message';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const validateCreateMeeting = [
  body('groupId').notEmpty().withMessage('Group ID hoặc Group Code là bắt buộc'),
  body('meetingTime').isISO8601().withMessage(MEETING_MESSAGE.INVALID_MEETING_TIME),
  body('location').notEmpty().withMessage('Địa điểm là bắt buộc'),
  body('agenda').notEmpty().withMessage('Nội dung họp là bắt buộc'),
  body('url').optional().isURL().withMessage(MEETING_MESSAGE.INVALID_MEETING_URL),

  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { groupId } = req.body;
    const mentorId = req.user!.userId;

    try {
      // Kiểm tra xem groupId là id hay code
      let group;
      
      // Nếu là UUID thì tìm theo id, nếu không thì tìm theo code
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(groupId);
      
      if (isUUID) {
        group = await prisma.group.findUnique({
          where: { id: groupId },
        });
      } else {
        // Tìm học kỳ hiện tại nếu không có semesterId
        const currentSemester = await prisma.semester.findFirst({
          where: { status: 'ACTIVE' },
          orderBy: { startDate: 'desc' },
        });

        if (!currentSemester) {
          return res.status(404).json({ message: "Không tìm thấy học kỳ hiện tại" });
        }

        // Tìm group theo groupCode và semesterId
        group = await prisma.group.findFirst({
          where: { 
            groupCode: groupId,
            semesterId: currentSemester.id
          },
        });
      }

      if (!group) {
        return res.status(404).json({ message: MEETING_MESSAGE.GROUP_NOT_FOUND });
      }

      // Lưu group.id vào req.body để sử dụng sau này
      req.body.groupId = group.id;

      // Kiểm tra xem user có phải là mentor của group không
      const isMentor = await prisma.groupMentor.findFirst({
        where: {
          groupId: group.id,
          mentorId
        }
      });
      
      if (!isMentor) {
        return res.status(403).json({ message: MEETING_MESSAGE.UNAUTHORIZED_MENTOR });
      }

      next();
    } catch (error) {
      console.error("Error in validateCreateMeeting middleware:", error);
      return res.status(500).json({ message: "Lỗi server khi xác thực dữ liệu" });
    }
  }
];

export const validateUpdateMeeting = [
  param('id').notEmpty().withMessage('Meeting ID là bắt buộc'),
  body('meetingTime').optional().isISO8601().withMessage(MEETING_MESSAGE.INVALID_MEETING_TIME),
  body('location').optional().notEmpty().withMessage('Địa điểm không được để trống'),
  body('agenda').optional().notEmpty().withMessage('Nội dung họp không được để trống'),
  body('url').optional().isURL().withMessage(MEETING_MESSAGE.INVALID_MEETING_URL),
  body('status').optional().isIn(['SCHEDULED', 'COMPLETED', 'CANCELLED']).withMessage('Trạng thái không hợp lệ'),

  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const mentorId = req.user!.userId;

      // Kiểm tra meeting có tồn tại không
      const meeting = await prisma.meetingSchedule.findUnique({
        where: { id }
      });

      if (!meeting) {
        return res.status(404).json({ message: MEETING_MESSAGE.MEETING_NOT_FOUND });
      }

      // Kiểm tra người cập nhật có phải là người tạo meeting không
      if (meeting.mentorId !== mentorId) {
        return res.status(403).json({ message: MEETING_MESSAGE.UNAUTHORIZED_MENTOR });
      }

      next();
    } catch (error) {
      console.error("Error in validateUpdateMeeting middleware:", error);
      return res.status(500).json({ message: "Lỗi server khi xác thực dữ liệu" });
    }
  }
]; 