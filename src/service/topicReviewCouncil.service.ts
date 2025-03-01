import { PrismaClient, Prisma } from "@prisma/client";
import { MESSAGES } from "../constants/message";

const prisma = new PrismaClient();

export class ReviewCouncilService {
  /**
   * Tạo hội đồng duyệt đề tài mới
   */
  async createReviewCouncil(data: {
    name: string;
    semesterId: string;
    councilType: string;
    startDate: Date;
    endDate: Date;
    description?: string;
    createdBy: string;
  }) {
    try {
      // Kiểm tra học kỳ tồn tại
      const semester = await prisma.semester.findUnique({
        where: { id: data.semesterId }
      });

      if (!semester) {
        throw new Error(MESSAGES.SEMESTER.SEMESTER_NOT_FOUND);
      }

      // Kiểm tra thời gian hợp lệ
      if (data.startDate >= data.endDate) {
        throw new Error("Thời gian bắt đầu phải trước thời gian kết thúc");
      }

      // Tạo mã hội đồng
      const councilCode = `RC-${Date.now()}`;

      // Tạo hội đồng duyệt đề tài
      const reviewCouncil = await prisma.reviewCouncil.create({
        data: {
          semesterId: data.semesterId,
          reviewType: data.councilType,
          room: "Online",
          councilCode: councilCode,
          startDate: data.startDate,
          endDate: data.endDate,
          status: "PENDING",
          url: "",
          createdBy: data.createdBy
        },
        include: {
          creator: true,
          semester: true
        }
      });

      // Tạo một Council tương ứng để liên kết với CouncilMember
      const councilName = `${councilCode} | ${data.councilType}`;
      
      // Sửa lại cách tạo Council vì MySQL không hỗ trợ RETURNING
      await prisma.$executeRaw`
        INSERT INTO councils (council_id, council_name, status, created_date)
        VALUES (UUID(), ${councilName}, 'PENDING', NOW())
      `;
      
      // Sau khi tạo, truy vấn để lấy ID vừa tạo
      const councilResult = await prisma.$queryRaw`
        SELECT council_id as id FROM councils 
        WHERE council_name = ${councilName}
        ORDER BY created_date DESC
        LIMIT 1
      `;
      
      const councilId = Array.isArray(councilResult) && councilResult.length > 0 
        ? (councilResult[0] as any).id 
        : null;

      return {
        ...reviewCouncil,
        councilId
      };
    } catch (error) {
      console.error("Error creating review council:", error);
      throw error;
    }
  }

  /**
   * Thêm thành viên vào hội đồng duyệt đề tài
   */
  async addMembersToReviewCouncil(
    reviewCouncilId: string,
    memberIds: string[]
  ) {
    try {
      // Kiểm tra hội đồng duyệt đề tài tồn tại
      const reviewCouncil = await prisma.reviewCouncil.findUnique({
        where: { id: reviewCouncilId }
      });

      if (!reviewCouncil) {
        throw new Error(MESSAGES.REVIEW_COUNCIL.NOT_FOUND);
      }

      // Tìm Council tương ứng với ReviewCouncil
      const councilResult = await prisma.$queryRaw`
        SELECT council_id as id FROM councils 
        WHERE council_name LIKE ${`%${reviewCouncil.councilCode}%`}
        LIMIT 1
      `;
      
      let councilId = Array.isArray(councilResult) && councilResult.length > 0 
        ? (councilResult[0] as any).id 
        : null;

      if (!councilId) {
        // Nếu không tìm thấy Council, tạo mới
        const councilName = `${reviewCouncil.councilCode} | ${reviewCouncil.reviewType}`;
        
        // Sửa lại cách tạo Council vì MySQL không hỗ trợ RETURNING
        await prisma.$executeRaw`
          INSERT INTO councils (council_id, council_name, status, created_date)
          VALUES (UUID(), ${councilName}, ${reviewCouncil.status}, NOW())
        `;
        
        // Sau khi tạo, truy vấn để lấy ID vừa tạo
        const newCouncilResult = await prisma.$queryRaw`
          SELECT council_id as id FROM councils 
          WHERE council_name = ${councilName}
          ORDER BY created_date DESC
          LIMIT 1
        `;
        
        councilId = Array.isArray(newCouncilResult) && newCouncilResult.length > 0 
          ? (newCouncilResult[0] as any).id 
          : null;
      }

      if (!councilId) {
        throw new Error("Không thể tạo hoặc tìm thấy Council");
      }

      // Kiểm tra các thành viên đã tồn tại trong hội đồng chưa
      const existingMembers = await prisma.councilMember.findMany({
        where: {
          councilId: councilId,
          userId: { in: memberIds }
        }
      });

      if (existingMembers.length > 0) {
        const existingIds = existingMembers.map(member => member.userId);
        throw new Error(`Các thành viên sau đã tồn tại trong hội đồng: ${existingIds.join(', ')}`);
      }

      // Thêm các thành viên vào hội đồng với vai trò mặc định là MEMBER
      const members = await Promise.all(
        memberIds.map((userId) => {
          return prisma.councilMember.create({
            data: {
              councilId: councilId!,
              userId,
              role: "MEMBER",
              assignedAt: new Date(),
              status: "ACTIVE",
              semesterId: reviewCouncil.semesterId
            }
          });
        })
      );

      return members;
    } catch (error) {
      console.error("Error adding members to review council:", error);
      throw error;
    }
  }

  /**
   * Gán người đánh giá chính cho hội đồng duyệt đề tài
   */
  async assignPrimaryReviewer(reviewCouncilId: string, reviewerId: string) {
    try {
      // Kiểm tra hội đồng duyệt đề tài tồn tại
      const reviewCouncil = await prisma.reviewCouncil.findUnique({
        where: { id: reviewCouncilId }
      });

      if (!reviewCouncil) {
        throw new Error(MESSAGES.REVIEW_COUNCIL.NOT_FOUND);
      }

      // Tìm Council tương ứng với ReviewCouncil
      const councilResult = await prisma.$queryRaw`
        SELECT council_id as id FROM councils 
        WHERE council_name LIKE ${`%${reviewCouncil.councilCode}%`}
        LIMIT 1
      `;
      
      let councilId = Array.isArray(councilResult) && councilResult.length > 0 
        ? (councilResult[0] as any).id 
        : null;

      if (!councilId) {
        // Nếu không tìm thấy Council, tạo mới
        const councilName = `${reviewCouncil.councilCode} | ${reviewCouncil.reviewType}`;
        
        // Sửa lại cách tạo Council vì MySQL không hỗ trợ RETURNING
        await prisma.$executeRaw`
          INSERT INTO councils (council_id, council_name, status, created_date)
          VALUES (UUID(), ${councilName}, ${reviewCouncil.status}, NOW())
        `;
        
        // Sau khi tạo, truy vấn để lấy ID vừa tạo
        const newCouncilResult = await prisma.$queryRaw`
          SELECT council_id as id FROM councils 
          WHERE council_name = ${councilName}
          ORDER BY created_date DESC
          LIMIT 1
        `;
        
        councilId = Array.isArray(newCouncilResult) && newCouncilResult.length > 0 
          ? (newCouncilResult[0] as any).id 
          : null;
      }

      if (!councilId) {
        throw new Error("Không thể tạo hoặc tìm thấy Council");
      }

      // Kiểm tra người đánh giá có phải là thành viên của hội đồng không
      const isMember = await prisma.councilMember.findFirst({
        where: {
          councilId: councilId,
          userId: reviewerId
        }
      });

      if (!isMember) {
        // Thêm người đánh giá vào hội đồng nếu chưa là thành viên
        await prisma.councilMember.create({
          data: {
            councilId: councilId,
            userId: reviewerId,
            role: "PRIMARY_REVIEWER",
            assignedAt: new Date(),
            status: "ACTIVE",
            semesterId: reviewCouncil.semesterId
          }
        });
      } else {
        // Cập nhật vai trò của thành viên thành người đánh giá chính
        await prisma.councilMember.update({
          where: {
            id: isMember.id
          },
          data: {
            role: "PRIMARY_REVIEWER"
          }
        });
      }

      // Cập nhật trạng thái của hội đồng duyệt đề tài
      const updatedReviewCouncil = await prisma.reviewCouncil.update({
        where: { id: reviewCouncilId },
        data: {
          status: "ACTIVE"
        },
        include: {
          creator: true,
          semester: true
        }
      });

      // Cập nhật trạng thái của Council
      await prisma.$executeRaw`
        UPDATE councils 
        SET status = 'ACTIVE' 
        WHERE council_id = ${councilId}
      `;

      return {
        ...updatedReviewCouncil,
        councilId
      };
    } catch (error) {
      console.error("Error assigning primary reviewer:", error);
      throw error;
    }
  }

  /**
   * Lấy danh sách hội đồng duyệt đề tài
   */
  async getReviewCouncils(params: {
    semesterId?: string;
    councilType?: string;
    status?: string;
    page: number;
    pageSize: number;
  }) {
    try {
      const { semesterId, councilType, status, page, pageSize } = params;

      // Xây dựng điều kiện tìm kiếm
      const where: any = {};
      if (semesterId) where.semesterId = semesterId;
      if (councilType) where.reviewType = councilType;
      if (status) where.status = status;

      // Đếm tổng số hội đồng
      const total = await prisma.reviewCouncil.count({ where });

      // Lấy danh sách hội đồng
      const councils = await prisma.reviewCouncil.findMany({
        where,
        include: {
          creator: true,
          semester: true
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: {
          createdAt: "desc"
        }
      });

      // Lấy thông tin Council tương ứng cho mỗi ReviewCouncil
      const councilsWithDetails = await Promise.all(
        councils.map(async (reviewCouncil) => {
          const councilResult = await prisma.$queryRaw`
            SELECT council_id as id FROM councils 
            WHERE council_name LIKE ${`%${reviewCouncil.councilCode}%`}
            LIMIT 1
          `;
          
          const councilId = Array.isArray(councilResult) && councilResult.length > 0 
            ? (councilResult[0] as any).id 
            : null;

          return {
            ...reviewCouncil,
            councilId
          };
        })
      );

      return {
        data: councilsWithDetails,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      console.error("Error getting review councils:", error);
      throw error;
    }
  }

  /**
   * Lấy chi tiết hội đồng duyệt đề tài
   */
  async getReviewCouncilDetail(reviewCouncilId: string) {
    try {
      const reviewCouncil = await prisma.reviewCouncil.findUnique({
        where: { id: reviewCouncilId },
        include: {
          creator: true,
          semester: true
        }
      });

      if (!reviewCouncil) {
        return null;
      }

      // Tìm Council tương ứng
      const councilResult = await prisma.$queryRaw`
        SELECT council_id as id FROM councils 
        WHERE council_name LIKE ${`%${reviewCouncil.councilCode}%`}
        LIMIT 1
      `;
      
      const councilId = Array.isArray(councilResult) && councilResult.length > 0 
        ? (councilResult[0] as any).id 
        : null;

      if (!councilId) {
        // Trả về thông tin ReviewCouncil mà không có thành viên
        return reviewCouncil;
      }

      // Lấy danh sách thành viên của hội đồng
      const members = await prisma.councilMember.findMany({
        where: { councilId: councilId }
      });

      // Lấy thông tin chi tiết của các thành viên
      const membersWithDetails = await Promise.all(
        members.map(async (member) => {
          const user = await prisma.user.findUnique({
            where: { id: member.userId },
            select: {
              id: true,
              fullName: true,
              email: true,
              avatar: true
            }
          });
          
          return {
            ...member,
            user
          };
        })
      );

      return {
        ...reviewCouncil,
        councilId,
        members: membersWithDetails
      };
    } catch (error) {
      console.error("Error getting review council detail:", error);
      throw error;
    }
  }

  /**
   * Import kết quả đánh giá đề tài
   */
  async importTopicEvaluations(
    reviewCouncilId: string,
    reviewerId: string,
    evaluations: Array<{
      topicId: string;
      status: string;
      rejectionReason?: string;
    }>
  ) {
    try {
      // Kiểm tra hội đồng duyệt đề tài tồn tại
      const reviewCouncil = await prisma.reviewCouncil.findUnique({
        where: { id: reviewCouncilId }
      });

      if (!reviewCouncil) {
        throw new Error(MESSAGES.REVIEW_COUNCIL.NOT_FOUND);
      }

      // Tìm Council tương ứng
      const councilResult = await prisma.$queryRaw`
        SELECT council_id as id FROM councils 
        WHERE council_name LIKE ${`%${reviewCouncil.councilCode}%`}
        LIMIT 1
      `;
      
      let councilId = Array.isArray(councilResult) && councilResult.length > 0 
        ? (councilResult[0] as any).id 
        : null;

      if (!councilId) {
        // Nếu không tìm thấy Council, tạo mới
        const councilName = `${reviewCouncil.councilCode} | ${reviewCouncil.reviewType}`;
        
        // Sửa lại cách tạo Council vì MySQL không hỗ trợ RETURNING
        await prisma.$executeRaw`
          INSERT INTO councils (council_id, council_name, status, created_date)
          VALUES (UUID(), ${councilName}, ${reviewCouncil.status}, NOW())
        `;
        
        // Sau khi tạo, truy vấn để lấy ID vừa tạo
        const newCouncilResult = await prisma.$queryRaw`
          SELECT council_id as id FROM councils 
          WHERE council_name = ${councilName}
          ORDER BY created_date DESC
          LIMIT 1
        `;
        
        councilId = Array.isArray(newCouncilResult) && newCouncilResult.length > 0 
          ? (newCouncilResult[0] as any).id 
          : null;
      }

      if (!councilId) {
        throw new Error("Không thể tạo hoặc tìm thấy Council");
      }

      // Kiểm tra người đánh giá có phải là thành viên của hội đồng không
      const isMember = await prisma.councilMember.findFirst({
        where: {
          councilId: councilId,
          userId: reviewerId,
          role: "PRIMARY_REVIEWER"
        }
      });

      if (!isMember) {
        throw new Error(MESSAGES.REVIEW_COUNCIL.UNAUTHORIZED);
      }

      // Cập nhật trạng thái của các đề tài
      const results = await Promise.all(
        evaluations.map(async (evaluation) => {
          try {
            // Kiểm tra đề tài tồn tại
            const topic = await prisma.topic.findUnique({
              where: { id: evaluation.topicId }
            });

            if (!topic) {
              return {
                topicId: evaluation.topicId,
                success: false,
                message: MESSAGES.TOPIC.TOPIC_NOT_FOUND
              };
            }

            // Cập nhật trạng thái đề tài
            await prisma.topic.update({
              where: { id: evaluation.topicId },
              data: {
                status: evaluation.status,
                updatedAt: new Date()
              }
            });

            // Tạo bản ghi đánh giá
            await prisma.reviewAssignment.create({
              data: {
                councilId: councilId!,
                topicId: evaluation.topicId,
                reviewerId,
                feedback: evaluation.rejectionReason,
                status: evaluation.status,
                assignedAt: new Date(),
                reviewedAt: new Date(),
                assignmentStatus: "COMPLETED"
              }
            });

            return {
              topicId: evaluation.topicId,
              success: true,
              message: "Đánh giá thành công"
            };
          } catch (error) {
            console.error(`Error updating topic ${evaluation.topicId}:`, error);
            return {
              topicId: evaluation.topicId,
              success: false,
              message: (error as Error).message
            };
          }
        })
      );

      // Cập nhật trạng thái của hội đồng nếu tất cả đề tài đã được đánh giá
      const successCount = results.filter(result => result.success).length;
      if (successCount === evaluations.length) {
        await prisma.reviewCouncil.update({
          where: { id: reviewCouncilId },
          data: {
            status: "COMPLETED"
          }
        });

        await prisma.$executeRaw`
          UPDATE councils 
          SET status = 'COMPLETED' 
          WHERE council_id = ${councilId}
        `;
      }

      return {
        total: evaluations.length,
        success: successCount,
        failed: evaluations.length - successCount,
        results
      };
    } catch (error) {
      console.error("Error importing topic evaluations:", error);
      throw error;
    }
  }
} 