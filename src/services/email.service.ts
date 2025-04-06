import { PrismaClient, User, Prisma } from "@prisma/client";
import { sendEmail } from "../utils/email";
import { EmailTemplateService } from "./emailTemplate.service";

const prisma = new PrismaClient();
const templateService = new EmailTemplateService();

export class EmailService {
  replacePlaceholders(text: string, data: Record<string, string | number | undefined>): string {
    return text.replace(/{{(.*?)}}/g, (_, key: string) => (data[key.trim()] || "").toString());
  }

  async sendGroupFormationNotification(userId: string, semesterId: string, templateId: string) {
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
    });
    if (!semester) {
      const error = new Error("Semester not found") as Error & { statusCode?: number };
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

      const emailSent = await sendEmail(
        student.user?.email || "",
        template.subject,
        emailBody
      );

      await prisma.emailLog.create({
        data: {
          userId,
          recipientEmail: student.user?.email || "",
          subject: template.subject,
          content: emailBody,
          status: emailSent ? "SENT" : "FAILED",
          errorAt: new Date(),
        },
      });
    }
  }

  async sendTopicDecisionAnnouncement(userId: string, semesterId: string, templateId: string) {
    // Lấy thông tin học kỳ
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
    });
    if (!semester) {
      const error = new Error("Semester not found") as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    // Lấy tất cả giảng viên trong học kỳ (dựa trên UserRole liên kết với Semester)
    const lecturers = await prisma.user.findMany({
      where: {
        lecturerCode: { not: null }, // Chỉ lấy giảng viên
        roles: {
          some: {
            semesterId: semesterId, // Liên kết với học kỳ qua UserRole
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

      const emailSent = await sendEmail(lecturer.email, template.subject, emailBody);

      await prisma.emailLog.create({
        data: {
          userId,
          recipientEmail: lecturer.email || "",
          subject: template.subject,
          content: emailBody,
          status: emailSent ? "SENT" : "FAILED",
          errorAt: new Date(),
        },
      });
    }
  }

  async sendReviewScheduleNotification(userId: string, reviewScheduleId: string, templateId: string): Promise<void> {
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
            mentors: {
              include: { mentor: true },
            },
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
      const error = new Error("Review schedule not found") as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    // Gom tất cả User vào mảng recipients, sau đó filter để loại bỏ null/undefined
    const recipients = [
      // Thành viên nhóm (user hoặc student.user)
      ...reviewSchedule.group.members.map(m => m.user ?? m.student?.user),

      // Mentor
      ...reviewSchedule.group.mentors.map(m => m.mentor),

      // Hội đồng
      ...reviewSchedule.council.members.map(m => m.user),
    ]
    // Filter cho biết: "sau khi lọc, kiểu phần tử chắc chắn là User"
    .filter((u): u is User => !!u);

    // Lấy template
    const template = await templateService.getTemplateById(templateId);

    for (const recipient of recipients) {
      // recipient lúc này chắc chắn là User
      const emailBody = this.replacePlaceholders(template.body, {
        username: recipient.username ?? "",
        reviewRound: reviewSchedule.reviewRound,
        reviewTime: reviewSchedule.reviewTime.toISOString().split("T")[0],
        room: reviewSchedule.room,
        semesterCode: reviewSchedule.group.semester.code,
      });

      // Gửi mail
      const emailSent = await sendEmail(recipient.email, template.subject, emailBody);

      // Log
      await prisma.emailLog.create({
        data: {
          userId,
          recipientEmail: recipient.email,
          subject: template.subject,
          content: emailBody,
          status: emailSent ? "SENT" : "FAILED",
          errorAt: new Date(),
        },
      });
    }
  }


  async sendInviteLecturersTopicRegistration(
    userId: string,
    templateId: string,
    semesterId: string
  ) {
    // 1. Lấy tất cả giảng viên (user có lecturerCode != null)
    const lecturers = await prisma.user.findMany({
      where: { lecturerCode: { not: null } },
    });
  
    // 2. Lấy template
    const template = await templateService.getTemplateById(templateId);
  
    // 3. Lấy semester
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
    });
    if (!semester) {
      throw new Error("Semester not found");
    }
  
    // 4. Gửi mail đến từng giảng viên
    for (const lecturer of lecturers) {
      // Thay placeholder. Nếu template có {{fullName}}, bạn có thể dùng lecturer.fullName.
      // Ở đây bạn dùng {{username}}, {{semesterCode}}
      const emailBody = this.replacePlaceholders(template.body, {
        username: lecturer.username ?? "",
        semesterCode: semester.code ?? "",
      });
  
      // Gửi mail
      const emailSent = await sendEmail(lecturer.email, template.subject, emailBody);
  
      // 5. Ghi log vào emailLog
      // Chọn 1 trong 2 cách tham chiếu user (tránh gộp chung):
      // *Cách A* - Chỉ dùng userId:
      await prisma.emailLog.create({
        data: {
          userId,
          recipientEmail: lecturer.email,
          subject: template.subject,
          content: emailBody,
          status: emailSent ? "SENT" : "FAILED",
          errorAt: new Date(),
          metadata: { attachment: null },
        },
      });
  
      // *Cách B* - Hoặc chỉ dùng user: { connect: { id: userId } }:
      /*
      await prisma.emailLog.create({
        data: {
          user: { connect: { id: userId } },
          recipientEmail: lecturer.email,
          subject: template.subject,
          content: emailBody,
          status: emailSent ? "SENT" : "FAILED",
          errorAt: new Date(),
          metadata: { attachment: null },
        },
      });
      */
    }
  }
  


  async sendApprovedTopicsNotification(userId: string) {
    const approvedTopics = await prisma.topic.findMany({
      where: { status: "APPROVED" },
      include: {
        creator: true,
        subMentor: true,
        group: { include: { members: { include: { user: true } }, mentors: { include: { mentor: true } } } },
      },
    });

    const template = await templateService.getTemplateByName("approved_topics_notification");
    for (const topic of approvedTopics) {
      const recipients: User[] = [
        topic.creator,
        topic.subMentor,
        ...(topic.group?.members.map((m) => m.user).filter((u): u is User => !!u) || []),
        ...(topic.group?.mentors.map((m) => m.mentor) || []),
      ].filter((u): u is User => !!u);

      for (const recipient of recipients) {
        const emailBody = this.replacePlaceholders(template.body, {
          fullName: recipient.fullName || "",
          topicName: topic.nameVi,
          topicCode: topic.topicCode,
        });

        const emailSent = await sendEmail(recipient.email, template.subject, emailBody);

        await prisma.emailLog.create({
          data: {
            userId,
            recipientEmail: recipient.email,
            subject: template.subject,
            content: emailBody,
            status: emailSent ? "SENT" : "FAILED",
            errorAt: new Date(),
            user: { connect: { id: userId } },
          } as Prisma.EmailLogCreateInput,
        });
      }
    }
  }

  async sendDefenseScheduleNotification(userId: string, defenseScheduleId: string) {
    const defenseSchedule = await prisma.defenseSchedule.findUnique({
      where: { id: defenseScheduleId },
      include: {
        group: { include: { members: { include: { user: true } }, mentors: { include: { mentor: true } } } },
        council: { include: { members: { include: { user: true } } } },
      },
    });
    if (!defenseSchedule) {
      const error = new Error("Defense schedule not found") as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const recipients: User[] = [
      ...defenseSchedule.group.members.map((m) => m.user).filter((u): u is User => !!u),
      ...defenseSchedule.group.mentors.map((m) => m.mentor),
      ...defenseSchedule.council.members.map((m) => m.user).filter((u): u is User => !!u),
    ];

    const template = await templateService.getTemplateByName("defense_schedule_notification");
    for (const recipient of recipients) {
      const emailBody = this.replacePlaceholders(template.body, {
        fullName: recipient.fullName || "",
        defenseRound: defenseSchedule.defenseRound,
        defenseTime: defenseSchedule.defenseTime.toISOString(),
        room: defenseSchedule.room,
      });

      const emailSent = await sendEmail(recipient.email, template.subject, emailBody);

      await prisma.emailLog.create({
        data: {
          userId,
          recipientEmail: recipient.email,
          subject: template.subject,
          content: emailBody,
          status: emailSent ? "SENT" : "FAILED",
          errorAt: new Date(),
          user: { connect: { id: userId } },
        } as Prisma.EmailLogCreateInput,
      });
    }
  }
}