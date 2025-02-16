import { Request, Response } from "express";
import { sendBulkEmailByQualification } from "../service/sendEmailByQualification.service";

export class EmailController {
  async sendEmailsByQualification(req: Request, res: Response) {
    const { semesterId, qualificationStatus } = req.body;

    if (!semesterId || !qualificationStatus) {
      return res.status(400).json({ message: "Missing semesterId or qualificationStatus." });
    }

    try {
      const userId = req.user.id; // Assuming userId is available in req.user
      const result = await sendBulkEmailByQualification(semesterId, qualificationStatus, userId);
      return res.status(200).json({
        message: "Emails sent successfully.",
        totalEmails: result.totalEmails,
        successCount: result.successCount,
        failedCount: result.failedCount,
        errors: result.errors,
      });
    } catch (error) {
      console.error("Failed to send emails:", error);
      return res.status(500).json({ message: "Failed to send emails.", error: (error as Error).message });
    }
  }
}
