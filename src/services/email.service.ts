import { PrismaClient, User, Prisma } from "@prisma/client";
import { emailQueue } from "../queue/emailQueue";
import { EmailTemplateService } from "./emailTemplate.service";

const prisma = new PrismaClient();
const templateService = new EmailTemplateService();

export class EmailService {
  replacePlaceholders(
    text: string,
    data: Record<string, string | number | undefined>
  ): string {
    return text.replace(/{{(.*?)}}/g, (_, key: string) =>
      (data[key.trim()] || "").toString()
    );
  }

  // Hàm helper để enqueue job gửi email
  private async enqueueEmailJob(jobData: {
    recipientEmail: string;
    subject: string;
    emailBody: string;
    userId: string;
  }) {
    const { recipientEmail, subject, emailBody, userId } = jobData;

    if (!recipientEmail || !subject || !emailBody || !userId) {
      console.error(`Dữ liệu job không hợp lệ: ${JSON.stringify(jobData)}`);
      return;
    }

    try {
      await emailQueue.add(jobData, {
        attempts: 5,
        backoff: { type: "exponential", delay: 10000 },
      });
      console.log(`Đã thêm job gửi email tới ${recipientEmail} vào hàng đợi`);
    } catch (error) {
      console.error(`Lỗi khi thêm job vào hàng đợi: ${(error as Error).message}`);
      throw error;
    }
  }

  async sendGroupFormationNotification(
    userId: string,
    semesterId: string,
    templateId: string
  ) {
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
    });
    if (!semester) {
      const error = new Error("Semester not found") as Error & {
        statusCode?: number;
      };
      error.statusCode = 404;
      throw error;
    }

    const students = await prisma.student.findMany({
      where: {
        status: "ACTIVE",
        groupMembers: { none: {} },
        semesterStudents: { some: { semesterId } },
      },
      include: { user: true },
    });

    const template = await templateService.getTemplateById(templateId);

    for (const student of students) {
      const emailBody = this.replacePlaceholders(template.body, {
        username: student.user?.username || "",
        studentCode: student.studentCode,
        semesterCode: semester.code,
      });

      // Enqueue job thay vì gửi email đồng bộ
      await this.enqueueEmailJob({
        recipientEmail: student.user?.email || "",
        subject: template.subject,
        emailBody,
        userId,
      });
    }
  }

  async sendTopicDecisionAnnouncement(
    userId: string,
    semesterId: string,
    templateId: string
  ) {
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
    });
    if (!semester) {
      const error = new Error("Semester not found") as Error & {
        statusCode?: number;
      };
      error.statusCode = 404;
      throw error;
    }

    const lecturers = await prisma.user.findMany({
      where: {
        lecturerCode: { not: null },
        roles: {
          some: {
            semesterId: semesterId,
            isActive: true,
          },
        },
      },
    });

    const template = await templateService.getTemplateById(templateId);

    for (const lecturer of lecturers) {
      const emailBody = this.replacePlaceholders(template.body, {
        username: lecturer.username || "",
        semesterCode: semester.code,
      });

      await this.enqueueEmailJob({
        recipientEmail: lecturer.email,
        subject: template.subject,
        emailBody,
        userId,
      });
    }
  }

  async sendReviewScheduleNotification(
    userId: string,
    reviewScheduleId: string,
    templateId: string
  ): Promise<void> {
    const reviewSchedule = await prisma.reviewSchedule.findUnique({
      where: { id: reviewScheduleId },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: true,
                student: { include: { user: true } },
              },
            },
            mentors: { include: { mentor: true } },
            semester: true,
          },
        },
        council: {
          include: {
            members: {
              include: { user: true },
            },
          },
        },
      },
    });

    if (!reviewSchedule) {
      const error = new Error("Review schedule not found") as Error & {
        statusCode?: number;
      };
      error.statusCode = 404;
      throw error;
    }

    const recipients: User[] = [
      ...reviewSchedule.group.members.map(
        (m) => m.user ?? m.student?.user
      ),
      ...reviewSchedule.group.mentors.map((m) => m.mentor),
      ...reviewSchedule.council.members.map((m) => m.user),
    ].filter((u): u is User => !!u);

    const template = await templateService.getTemplateById(templateId);

    for (const recipient of recipients) {
      const emailBody = this.replacePlaceholders(template.body, {
        username: recipient.username ?? "",
        reviewRound: reviewSchedule.reviewRound,
        reviewTime: reviewSchedule.reviewTime.toISOString().split("T")[0],
        room: reviewSchedule.room,
        semesterCode: reviewSchedule.group.semester.code,
      });

      await this.enqueueEmailJob({
        recipientEmail: recipient.email,
        subject: template.subject,
        emailBody,
        userId,
      });
    }
  }

  async sendInviteLecturersTopicRegistration(
    userId: string,
    templateId: string,
    semesterId: string
  ) {
    const lecturers = await prisma.user.findMany({
      where: { lecturerCode: { not: null } },
    });

    const template = await templateService.getTemplateById(templateId);

    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
    });
    if (!semester) {
      throw new Error("Semester not found");
    }

    for (const lecturer of lecturers) {
      const emailBody = this.replacePlaceholders(template.body, {
        username: lecturer.username ?? "",
        semesterCode: semester.code ?? "",
      });

      await this.enqueueEmailJob({
        recipientEmail: lecturer.email,
        subject: template.subject,
        emailBody,
        userId,
      });
    }
  }

  async sendApprovedTopicsNotification(
    userId: string,
    templateId: string,
    semesterId: string
  ): Promise<void> {
    const approvedTopics = await prisma.topic.findMany({
      where: {
        status: "APPROVED",
        semesterId: semesterId,
      },
      include: {
        creator: true,
        subMentor: true,
        group: {
          include: {
            members: {
              include: { user: true },
            },
            mentors: {
              include: { mentor: true },
            },
            semester: true,
          },
        },
      },
    });

    const template = await templateService.getTemplateById(templateId);

    for (const topic of approvedTopics) {
      const recipients: User[] = [
        topic.creator,
        topic.subMentor,
        ...(topic.group?.members
          .map((m) => m.user)
          .filter((u): u is User => !!u) || []),
        ...(topic.group?.mentors
          .map((m) => m.mentor)
          .filter((u): u is User => !!u) || []),
      ].filter((u): u is User => !!u);

      for (const recipient of recipients) {
        const emailBody = this.replacePlaceholders(template.body, {
          username: recipient.username || "",
          topicNameVi: topic.nameVi,
          topicNameEn: topic.nameEn || "",
          topicCode: topic.topicCode,
          groupCode: topic.group?.groupCode || "",
          semesterCode: topic.group?.semester?.code || "",
        });

        await this.enqueueEmailJob({
          recipientEmail: recipient.email,
          subject: template.subject,
          emailBody,
          userId,
        });
      }
    }
  }

  async sendDefenseScheduleNotification(
    userId: string,
    defenseScheduleId: string,
    templateId: string
  ): Promise<void> {
    const defenseSchedule = await prisma.defenseSchedule.findUnique({
      where: { id: defenseScheduleId },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: true,
                student: { include: { user: true } },
              },
            },
            mentors: { include: { mentor: true } },
            semester: true,
          },
        },
        council: {
          include: {
            members: {
              include: { user: true },
            },
          },
        },
      },
    });

    if (!defenseSchedule) {
      const error = new Error("Defense schedule not found") as Error & {
        statusCode?: number;
      };
      error.statusCode = 404;
      throw error;
    }

    const recipients: User[] = [
      ...(defenseSchedule.group?.members
        .map((m) => m.user ?? m.student?.user)
        .filter((u): u is User => !!u) || []),
      ...(defenseSchedule.group?.mentors
        .map((m) => m.mentor)
        .filter((u): u is User => !!u) || []),
      ...(defenseSchedule.council?.members
        .map((m) => m.user)
        .filter((u): u is User => !!u) || []),
    ];

    const template = await templateService.getTemplateById(templateId);
    const semesterCode = defenseSchedule.group?.semester?.code || "";

    for (const recipient of recipients) {
      const emailBody = this.replacePlaceholders(template.body, {
        username: recipient.username || "",
        defenseRound: defenseSchedule.defenseRound,
        defenseTime: defenseSchedule.defenseTime.toISOString().split("T")[0],
        room: defenseSchedule.room || "",
        semesterCode: semesterCode,
        groupCode: defenseSchedule.group?.groupCode || "",
      });

      await this.enqueueEmailJob({
        recipientEmail: recipient.email,
        subject: template.subject,
        emailBody,
        userId,
      });
    }
  }

  async sendThesisEligibilityNotifications(
    userId: string,
    semesterId: string,
    templateId: string
  ): Promise<number> { // Trả về số lượng email xếp hàng
    try {
      if (!userId) {
        throw new Error("User ID is required");
      }

      const semester = await prisma.semester.findUnique({
        where: { id: semesterId },
      });
      if (!semester) {
        throw new Error("Không tìm thấy kỳ học");
      }
      const semesterCode = semester.code;

      const records = await prisma.semesterStudent.findMany({
        where: { semesterId, isDeleted: false },
        include: {
          student: { include: { user: true } },
        },
      });

      if (records.length === 0) {
        console.log("Không có sinh viên nào trong kỳ học này");
        return 0;
      }

      const template = await templateService.getTemplateById(templateId);
      if (!template) {
        throw new Error("Không tìm thấy mẫu email");
      }

      let queuedEmails = 0;
      for (const record of records) {
        const student = record.student;
        if (!student || !student.user || !student.user.email) {
          console.warn(`Bỏ qua bản ghi không có sinh viên, người dùng hoặc email: ${record.id}`);
          continue;
        }

        const eligibilityMessage = record.isEligible ? "Đủ điều kiện" : "Chưa đủ điều kiện";
        const emailBody = this.replacePlaceholders(template.body, {
          username: student.user.username || "Sinh viên",
          semesterCode: semesterCode,
          eligibilityMessage: eligibilityMessage,
        });

        await this.enqueueEmailJob({
          recipientEmail: student.user.email,
          subject: template.subject,
          emailBody,
          userId,
        });
        queuedEmails++;
      }

      console.log(`Đã xếp hàng đợi gửi thông báo cho ${queuedEmails} sinh viên`);
      return queuedEmails;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Lỗi trong sendThesisEligibilityNotifications: ${error.message}`);
      } else {
        console.error("Lỗi không xác định trong sendThesisEligibilityNotifications:", error);
      }
      throw error;
    }
  }
}
