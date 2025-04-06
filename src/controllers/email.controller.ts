import { Request, Response } from "express";
import { EmailService } from "../services/email.service";

const service = new EmailService();

export class EmailController {
  async sendGroupFormationNotification(req: Request, res: Response) {
    const { semesterId, templateId } = req.body as { semesterId?: string; templateId?: string };
    if (!semesterId) return res.status(400).json({ message: "Semester ID is required" });
    if (!templateId) return res.status(400).json({ message: "Template ID is required" });

    await service.sendGroupFormationNotification(req.user?.userId ?? "", semesterId, templateId);
    return res.status(200).json({ message: "Emails sent successfully" });
  }

  async sendTopicDecisionAnnouncement(req: Request, res: Response) {
    const { semesterId, templateId } = req.body as { semesterId?: string; templateId?: string };
    if (!semesterId) return res.status(400).json({ message: "Semester ID is required" });
    if (!templateId) return res.status(400).json({ message: "Template ID is required" });

    await service.sendTopicDecisionAnnouncement(req.user?.userId ?? "", semesterId, templateId);
    return res.status(200).json({ message: "Emails sent successfully" });
  }

  async sendReviewScheduleNotification(req: Request, res: Response) {
    const { reviewScheduleId, templateId } = req.body as { reviewScheduleId?: string; templateId?: string };
    if (!reviewScheduleId) return res.status(400).json({ message: "Review Schedule ID is required" });
    if (!templateId) return res.status(400).json({ message: "Template ID is required" });

    await service.sendReviewScheduleNotification(req.user?.userId ?? "", reviewScheduleId, templateId);
    return res.status(200).json({ message: "Emails sent successfully" });
  }

  async sendInviteLecturersTopicRegistration(req: Request, res: Response) {
    const { templateId, semesterId } = req.body as {
      templateId?: string;
      semesterId?: string;
    };
  
    if (!templateId) {
      return res.status(400).json({ message: "Template ID is required" });
    }
    if (!semesterId) {
      return res.status(400).json({ message: "Semester ID is required" });
    }
  
    // Gọi hàm service (cũng là async)
    await service.sendInviteLecturersTopicRegistration(
      req.user?.userId ?? "",
      templateId,
      semesterId
    );
  
    return res.status(200).json({ message: "Emails sent successfully" });
  }
  

  async sendApprovedTopicsNotification(req: Request, res: Response) {
    await service.sendApprovedTopicsNotification(req.user?.userId);
    return res.status(200).json({ message: "Emails sent successfully" });
  }

  async sendDefenseScheduleNotification(req: Request, res: Response) {
    const { defenseScheduleId } = req.body as { defenseScheduleId?: string };
    if (!defenseScheduleId) return res.status(400).json({ message: "Defense Schedule ID is required" });

    await service.sendDefenseScheduleNotification(req.user?.userId, defenseScheduleId);
    return res.status(200).json({ message: "Emails sent successfully" });
  }
}