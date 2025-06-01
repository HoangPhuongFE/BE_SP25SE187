import { PrismaClient, User, Prisma } from "@prisma/client";
import { sendEmail } from "../utils/email";
import { EmailTemplateService } from "./emailTemplate.service";
import { group } from "console";
import e from "express";

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

    }
  }



  async sendApprovedTopicsNotification(
    userId: string,
    templateId: string,
    semesterId: string
  ): Promise<void> {
    // 1) Lọc topic => status=APPROVED, semesterId = the one provided
    const approvedTopics = await prisma.topic.findMany({
      where: {
        status: "APPROVED",
        semesterId: semesterId, // Lọc theo học kỳ 
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
            semester: true, // Để lấy semester.code (nếu group thuộc 1 semester)
          },
        },
      },
    });

    // 2) Lấy template từ DB
    const template = await templateService.getTemplateById(templateId);

    // 3) Vòng lặp qua từng topic
    for (const topic of approvedTopics) {
      // Gom danh sách người nhận
      const recipients: User[] = [
        topic.creator,
        topic.subMentor,
        ...(topic.group?.members.map((m) => m.user).filter((u): u is User => !!u) || []),
        ...(topic.group?.mentors.map((m) => m.mentor).filter((u): u is User => !!u) || []),
      ].filter((u): u is User => !!u);

      // 4) Gửi mail cho từng user
      for (const recipient of recipients) {
        // Chuẩn bị data cho placeholders
        const emailBody = this.replacePlaceholders(template.body, {
          username: recipient.username || "",
          topicNameVi: topic.nameVi,
          topicNameEn: topic.nameEn || "",
          topicCode: topic.topicCode,
          groupCode: topic.group?.groupCode || "",
          // Lấy semesterCode nếu group có .semester
          semesterCode: topic.group?.semester?.code || "",
        });

        // Gửi email
        const emailSent = await sendEmail(recipient.email, template.subject, emailBody);

        // Ghi log
        await prisma.emailLog.create({
          data: {
            userId,
            recipientEmail: recipient.email,
            subject: template.subject,
            content: emailBody,
            status: emailSent ? "SENT" : "FAILED",
            errorAt: new Date()
          } as unknown as Prisma.EmailLogCreateInput,
        });
      }
    }
  }

  async sendDefenseScheduleNotification(
    userId: string,
    defenseScheduleId: string,
    templateId: string
  ): Promise<void> {
    // 1) Truy vấn defenseSchedule với các quan hệ cần thiết
    const defenseSchedule = await prisma.defenseSchedule.findUnique({
      where: { id: defenseScheduleId },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: true,
                student: { include: { user: true } }
              }
            },
            mentors: { include: { mentor: true } },
            // Lấy thông tin học kỳ từ group nếu có
            semester: true,
            // Nếu muốn lấy groupCode, đảm bảo group có trường groupCode
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
      const error = new Error("Defense schedule not found") as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    // 2) Gom danh sách recipients:
    //    - Từ group.members: lấy m.user nếu có, nếu không lấy m.student?.user
    //    - Từ group.mentors: lấy m.mentor
    //    - Từ council.members: lấy m.user
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

    // 3) Lấy template từ DB theo templateId
    const template = await templateService.getTemplateById(templateId);

    // 4) Lấy mã học kỳ từ group.semester (nếu có)
    const semesterCode = defenseSchedule.group?.semester?.code || "";

    // 5) Gửi mail cho từng người nhận và ghi log
    for (const recipient of recipients) {
      const emailBody = this.replacePlaceholders(template.body, {
        username: recipient.username || "",
        defenseRound: defenseSchedule.defenseRound,
        // Định dạng ngày theo YYYY-MM-DD
        defenseTime: defenseSchedule.defenseTime.toISOString().split("T")[0],
        room: defenseSchedule.room || "",
        semesterCode: semesterCode,
        groupCode: defenseSchedule.group?.groupCode || "",
        // Nếu cần bổ sung groupCode, bạn có thể thêm: groupCode: defenseSchedule.group?.groupCode || ""
      });

      const emailSent = await sendEmail(recipient.email, template.subject, emailBody);

      // Lưu log: Chỉ cần chọn 1 cách: hoặc truyền trực tiếp userId hoặc dùng quan hệ user: { connect: { id: userId } }
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

  async sendThesisEligibilityNotifications(
    userId: string,
    semesterId: string,
    templateId: string
  ): Promise<void> {
    // 1. Lấy thông tin học kỳ để lấy semesterCode
    const semester = await prisma.semester.findUnique({
      where: { id: semesterId },
    });
    if (!semester) {
      throw new Error("Semester not found");
    }
    const semesterCode = semester.code;
  
    // 2. Lấy tất cả các record của sinh viên trong học kỳ đó
    const records = await prisma.semesterStudent.findMany({
      where: { semesterId, isDeleted: false },
      include: {
        student: {
          include: { user: true }
        }
      }
    });
  
    // 3. Lấy template email theo templateId
    const template = await templateService.getTemplateById(templateId);
  
    // 4. Gửi email cho từng sinh viên
    for (const record of records) {
      const student = record.student;
      if (!student || !student.user) continue; // Bỏ qua nếu thiếu thông tin
  
      // Xác định thông điệp điều kiện dựa trên record.isEligible
      const eligibilityMessage = record.isEligible ? "Đủ điều kiện" : "Chưa đủ điều kiện";
  
      const emailBody = this.replacePlaceholders(template.body, {
        username: student.user.username,
        semesterCode: semesterCode,
        eligibilityMessage: eligibilityMessage,
        email: student.user.email
      });
  
      const emailSent = await sendEmail(student.user.email, template.subject, emailBody);
  
      // Ghi log gửi email, sử dụng quan hệ user (chỉ dùng user.connect)
      await prisma.emailLog.create({
        data: {
          recipientEmail: student.user.email,
          subject: template.subject,
          content: emailBody,
          status: emailSent ? "SENT" : "FAILED",
          errorAt: new Date(),
          user: { connect: { id: userId } }
        } as Prisma.EmailLogCreateInput,
      });
    }
  }
  

}