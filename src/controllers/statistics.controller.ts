import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { MESSAGES } from '../constants/message';

const prisma = new PrismaClient();

// Định nghĩa interface cho thống kê theo ngành
interface MajorStats {
  totalGroups: number;
  totalStudents: number;
  multiMajorGroups: number;
}

interface MajorStatsMap {
  [key: string]: MajorStats;
}

// Định nghĩa interface cho thống kê đề tài theo ngành
interface TopicMajorStats {
  totalTopics: number;
  businessTopics: number;
  researchTopics: number;
  assignedTopics: number;
}

interface TopicMajorStatsMap {
  [key: string]: TopicMajorStats;
}

// Hàm helper để lấy thống kê điểm số cho một round cụ thể
const getScoreStatsForRound = async (reviewRound: number) => {
  return await prisma.reviewAssignment.groupBy({
    by: ['reviewRound'],
    where: {
      isDeleted: false,
      score: {
        not: null
      },
      reviewRound: reviewRound
    },
    _avg: {
      score: true
    },
    _min: {
      score: true
    },
    _max: {
      score: true
    }
  });
};

// Hàm helper để lấy thống kê trạng thái cho một round cụ thể
const getStatusStatsForRound = async (reviewRound: number) => {
  return await prisma.reviewSchedule.groupBy({
    by: ['status'],
    where: {
      reviewRound: reviewRound,
      isDeleted: false
    },
    _count: {
      status: true
    }
  });
};

// Hàm helper để lấy tổng số phiên đánh giá cho một round cụ thể
const getTotalReviewsForRound = async (reviewRound: number) => {
  const result = await prisma.reviewSchedule.groupBy({
    by: ['reviewRound'],
    where: {
      isDeleted: false,
      reviewRound: reviewRound
    },
    _count: {
      reviewRound: true
    }
  });
  return result[0]?._count.reviewRound || 0;
};

// Hàm helper để lấy thống kê nhóm theo ngành
const getGroupStatsByMajor = async () => {
  return await prisma.group.findMany({
    where: {
      isDeleted: false
    },
    include: {
      members: {
        include: {
          student: {
            include: {
              major: true
            }
          }
        }
      }
    }
  });
};

// Hàm helper để lấy thống kê nhóm theo trạng thái
const getGroupStatsByStatus = async () => {
  return await prisma.group.groupBy({
    by: ['status'],
    where: {
      isDeleted: false
    },
    _count: {
      status: true
    }
  });
};

// Hàm helper để lấy thống kê tổng quan về nhóm
const getOverallGroupStats = async () => {
  const totalGroups = await prisma.group.count({
    where: {
      isDeleted: false
    }
  });

  const totalMembers = await prisma.groupMember.count({
    where: {
      isDeleted: false,
      isActive: true
    }
  });

  const multiMajorGroups = await prisma.group.count({
    where: {
      isDeleted: false,
      isMultiMajor: true
    }
  });

  const averageMembersPerGroup = totalGroups > 0 ? totalMembers / totalGroups : 0;

  return {
    totalGroups,
    totalMembers,
    multiMajorGroups,
    averageMembersPerGroup
  };
};

// Hàm helper để lấy thống kê tổng quan về đề tài
const getOverallTopicStats = async () => {
  const totalTopics = await prisma.topic.count({
    where: {
      isDeleted: false
    }
  });

  const businessTopics = await prisma.topic.count({
    where: {
      isDeleted: false,
      isBusiness: true
    }
  });

  const researchTopics = await prisma.topic.count({
    where: {
      isDeleted: false,
      isBusiness: false
    }
  });

  const assignedTopics = await prisma.topicAssignment.count({
    where: {
      isDeleted: false,
      status: "ASSIGNED"
    }
  });

  return {
    totalTopics,
    businessTopics,
    researchTopics,
    assignedTopics,
    unassignedTopics: totalTopics - assignedTopics
  };
};

// Hàm helper để lấy thống kê đề tài theo ngành
const getTopicStatsByMajor = async () => {
  return await prisma.topic.findMany({
    where: {
      isDeleted: false
    },
    include: {
      majors: true
    }
  });
};

// Hàm helper để lấy thống kê đề tài theo trạng thái
const getTopicStatsByStatus = async () => {
  return await prisma.topic.groupBy({
    by: ['status'],
    where: {
      isDeleted: false
    },
    _count: {
      status: true
    }
  });
};

// Hàm helper để lấy thống kê đề tài theo loại (doanh nghiệp/nghiên cứu)
const getTopicStatsByType = async () => {
  return await prisma.topic.groupBy({
    by: ['isBusiness'],
    where: {
      isDeleted: false
    },
    _count: {
      isBusiness: true
    }
  });
};

// Hàm helper để lấy thống kê tổng quan về hội đồng duyệt đề tài
const getOverallCouncilTopicStats = async () => {
  const totalCouncils = await prisma.council.count({
    where: {
      isDeleted: false,
      type: "topic"
    }
  });

  const totalMembers = await prisma.councilMember.count({
    where: {
      isDeleted: false,
      council: {
        type: "topic",
        isDeleted: false
      }
    }
  });

  const averageMembersPerCouncil = totalCouncils > 0 ? totalMembers / totalCouncils : 0;

  const councilsByStatus = await prisma.council.groupBy({
    by: ['status'],
    where: {
      isDeleted: false,
      type: "topic"
    },
    _count: {
      status: true
    }
  });

  return {
    totalCouncils,
    totalMembers,
    averageMembersPerCouncil,
    statusBreakdown: councilsByStatus
  };
};

// Hàm helper để lấy thống kê hội đồng theo đợt xét duyệt
const getCouncilTopicStatsBySubmissionPeriod = async () => {
  const submissionPeriods = await prisma.submissionPeriod.findMany({
    where: {
      isDeleted: false
    },
    include: {
      topics: {
        where: {
          isDeleted: false
        },
        include: {
          topicRegistrations: {
            where: {
              isDeleted: false
            }
          }
        }
      },
      councils: {
        where: {
          isDeleted: false,
          type: "topic"
        },
        include: {
          members: {
            where: {
              isDeleted: false
            }
          }
        }
      }
    }
  });

  // Xử lý thống kê cho từng đợt
  const statsByPeriod = submissionPeriods.map(period => {
    const council = period.councils[0]; // Mỗi đợt chỉ có 1 hội đồng
    const totalTopics = period.topics.length;
    const approvedTopics = period.topics.filter(topic => 
      topic.topicRegistrations.some(reg => reg.status === "APPROVED")
    ).length;
    const rejectedTopics = period.topics.filter(topic => 
      topic.topicRegistrations.some(reg => reg.status === "REJECTED")
    ).length;
    const pendingTopics = period.topics.filter(topic => 
      topic.topicRegistrations.some(reg => reg.status === "PENDING")
    ).length;

    return {
      periodId: period.id,
      roundNumber: period.roundNumber,
      startDate: period.startDate,
      endDate: period.endDate,
      councilInfo: council ? {
        councilId: council.id,
        councilName: council.name,
        councilCode: council.code,
        totalMembers: council.members.length,
        members: council.members.map(member => ({
          id: member.userId,
          role: member.roleId
        }))
      } : null,
      topicStatistics: {
        totalTopics,
        approvedTopics,
        rejectedTopics,
        pendingTopics,
        approvalRate: totalTopics > 0 ? (approvedTopics / totalTopics) * 100 : 0,
        rejectionRate: totalTopics > 0 ? (rejectedTopics / totalTopics) * 100 : 0,
        pendingRate: totalTopics > 0 ? (pendingTopics / totalTopics) * 100 : 0
      }
    };
  });

  return statsByPeriod;
};

// Hàm helper để lấy thống kê thành viên hội đồng
const getCouncilTopicMemberStats = async () => {
  const councils = await prisma.council.findMany({
    where: {
      isDeleted: false,
      type: "topic"
    },
    include: {
      members: {
        where: {
          isDeleted: false
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          },
          role: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  });

  // Thống kê theo hội đồng
  const statsByCouncil = councils.map(council => {
    // Nhóm thành viên theo vai trò trong hội đồng
    const membersByRole = council.members.reduce((acc, member) => {
      const roleName = member.role.name;
      if (!acc[roleName]) {
        acc[roleName] = {
          roleName,
          totalMembers: 0,
          members: []
        };
      }
      acc[roleName].totalMembers++;
      acc[roleName].members.push({
        id: member.user.id,
        fullName: member.user.fullName,
        email: member.user.email
      });
      return acc;
    }, {} as Record<string, any>);

    return {
      councilId: council.id,
      councilName: council.name,
      councilCode: council.code,
      status: council.status,
      totalMembers: council.members.length,
      membersByRole: Object.values(membersByRole)
    };
  });

  return statsByCouncil;
};

// Hàm helper để lấy thống kê tổng quan về hội đồng bảo vệ
const getOverallCouncilDefenseStats = async () => {
  const totalCouncils = await prisma.council.count({
    where: {
      isDeleted: false,
      type: "defense"
    }
  });

  const totalMembers = await prisma.councilMember.count({
    where: {
      isDeleted: false,
      council: {
        type: "defense",
        isDeleted: false
      }
    }
  });

  const averageMembersPerCouncil = totalCouncils > 0 ? totalMembers / totalCouncils : 0;

  const councilsByStatus = await prisma.council.groupBy({
    by: ['status'],
    where: {
      isDeleted: false,
      type: "defense"
    },
    _count: {
      status: true
    }
  });

  const councilsByRound = await prisma.council.groupBy({
    by: ['round'],
    where: {
      isDeleted: false,
      type: "defense"
    },
    _count: {
      round: true
    }
  });

  return {
    totalCouncils,
    totalMembers,
    averageMembersPerCouncil,
    statusBreakdown: councilsByStatus,
    roundBreakdown: councilsByRound
  };
};

// // Hàm helper để lấy thống kê hội đồng theo đợt bảo vệ
// const getCouncilDefenseStatsByRound = async () => {
//   const councils = await prisma.council.findMany({
//     where: {
//       isDeleted: false,
//       type: "defense"
//     },
//     include: {
//       members: {
//         where: {
//           isDeleted: false
//         }
//       },
//       defenseSchedules: {
//         where: {
//           isDeleted: false
//         },
//         include: {
//           group: {
//             include: {
//               topicAssignments: {
//                 where: {
//                   isDeleted: false
//                 },
//                 include: {
//                   topic: true
//                 }
//               }
//             }
//           }
//         }
//       }
//     }
//   });

//   // Nhóm theo round
//   const statsByRound = councils.reduce((acc, council) => {
//     const round = council.round || 0;
//     if (!acc[round]) {
//       acc[round] = {
//         round,
//         totalCouncils: 0,
//         totalMembers: 0,
//         totalGroups: 0,
//         averageMembersPerCouncil: 0,
//         statusBreakdown: {} as Record<string, number>,
//         resultBreakdown: {
//           passed: 0,
//           failed: 0,
//           pending: 0
//         },
//         councils: [] // Thêm danh sách hội đồng cho mỗi round
//       };
//     }

//     // Thêm thông tin hội đồng vào round tương ứng
//     acc[round].councils.push({
//       councilId: council.id,
//       councilName: council.name,
//       councilCode: council.code,
//       totalMembers: council.members.length,
//       members: council.members.map(member => ({
//         id: member.userId,
//         role: member.roleId
//       })),
//       totalGroups: council.defenseSchedules.length,
//       status: council.status
//     });

//     acc[round].totalCouncils++;
//     acc[round].totalMembers += council.members.length;
//     acc[round].totalGroups += council.defenseSchedules.length;

//     if (council.status) {
//       acc[round].statusBreakdown[council.status] = (acc[round].statusBreakdown[council.status] || 0) + 1;
//     }

//     // Thống kê kết quả bảo vệ
//     council.defenseSchedules.forEach(schedule => {
//       if (schedule.result === "PASSED") {
//         acc[round].resultBreakdown.passed++;
//       } else if (schedule.result === "FAILED") {
//         acc[round].resultBreakdown.failed++;
//       } else {
//         acc[round].resultBreakdown.pending++;
//       }
//     });

//     return acc;
//   }, {} as Record<number, any>);

//   // Tính trung bình số thành viên cho mỗi round
//   Object.values(statsByRound).forEach(round => {
//     round.averageMembersPerCouncil = round.totalCouncils > 0 ? round.totalMembers / round.totalCouncils : 0;
//   });

//   return Object.values(statsByRound);
// };

// Hàm helper để lấy thống kê thành viên hội đồng bảo vệ
const getCouncilDefenseMemberStats = async () => {
  const members = await prisma.councilMember.findMany({
    where: {
      isDeleted: false,
      council: {
        type: "defense",
        isDeleted: false
      }
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      },
      role: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  // Thống kê theo vai trò
  const statsByRole = members.reduce((acc, member) => {
    const roleName = member.role.name;
    if (!acc[roleName]) {
      acc[roleName] = {
        roleName,
        totalMembers: 0,
        members: []
      };
    }
    acc[roleName].totalMembers++;
    acc[roleName].members.push({
      id: member.user.id,
      fullName: member.user.fullName,
      email: member.user.email
    });
    return acc;
  }, {} as Record<string, any>);

  return Object.values(statsByRole);
};

export const getReview1Statistics = async (req: Request, res: Response) => {
  try {
    const statusBreakdown = await getStatusStatsForRound(1);
    const total = await getTotalReviewsForRound(1);
    const scoreStats = await getScoreStatsForRound(1);

    const statistics = {
      statusBreakdown,
      total,
      scoreStatistics: scoreStats
    };

    return res.status(200).json({
      message: MESSAGES.GENERAL.ACTION_SUCCESS,
      data: statistics
    });

  } catch (error) {
    console.error('Error getting review 1 statistics:', error);
    return res.status(500).json({
      message: MESSAGES.GENERAL.SERVER_ERROR,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

export const getReview2Statistics = async (req: Request, res: Response) => {
  try {
    const statusBreakdown = await getStatusStatsForRound(2);
    const total = await getTotalReviewsForRound(2);
    const scoreStats = await getScoreStatsForRound(2);

    const statistics = {
      statusBreakdown,
      total,
      scoreStatistics: scoreStats
    };

    return res.status(200).json({
      message: MESSAGES.GENERAL.ACTION_SUCCESS,
      data: statistics
    });

  } catch (error) {
    console.error('Error getting review 2 statistics:', error);
    return res.status(500).json({
      message: MESSAGES.GENERAL.SERVER_ERROR,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

export const getReview3Statistics = async (req: Request, res: Response) => {
  try {
    const statusBreakdown = await getStatusStatsForRound(3);
    const total = await getTotalReviewsForRound(3);
    const scoreStats = await getScoreStatsForRound(3);

    const statistics = {
      statusBreakdown,
      total,
      scoreStatistics: scoreStats
    };

    return res.status(200).json({
      message: MESSAGES.GENERAL.ACTION_SUCCESS,
      data: statistics
    });

  } catch (error) {
    console.error('Error getting review 3 statistics:', error);
    return res.status(500).json({
      message: MESSAGES.GENERAL.SERVER_ERROR,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

export const getGroupStatistics = async (req: Request, res: Response) => {
  try {
    const statistics = await getOverallGroupStats();

    return res.status(200).json({
      message: MESSAGES.GENERAL.ACTION_SUCCESS,
      data: statistics
    });

  } catch (error) {
    console.error('Error getting group statistics:', error);
    return res.status(500).json({
      message: MESSAGES.GENERAL.SERVER_ERROR,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

export const getGroupByMajorStatistics = async (req: Request, res: Response) => {
  try {
    const groups = await getGroupStatsByMajor();
    
    // Xử lý dữ liệu để nhóm theo ngành
    const majorStats: MajorStatsMap = groups.reduce((acc, group) => {
      const majors = new Set(group.members
        .filter(member => member.student?.major?.name)
        .map(member => member.student?.major?.name));
      
      majors.forEach(major => {
        if (major) {
          if (!acc[major]) {
            acc[major] = {
              totalGroups: 0,
              totalStudents: 0,
              multiMajorGroups: 0
            };
          }
          acc[major].totalGroups++;
          acc[major].totalStudents += group.members.length;
          if (group.isMultiMajor) {
            acc[major].multiMajorGroups++;
          }
        }
      });
      
      return acc;
    }, {} as MajorStatsMap);

    return res.status(200).json({
      message: MESSAGES.GENERAL.ACTION_SUCCESS,
      data: majorStats
    });

  } catch (error) {
    console.error('Error getting group by major statistics:', error);
    return res.status(500).json({
      message: MESSAGES.GENERAL.SERVER_ERROR,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

export const getGroupByStatusStatistics = async (req: Request, res: Response) => {
  try {
    const statusStats = await getGroupStatsByStatus();

    return res.status(200).json({
      message: MESSAGES.GENERAL.ACTION_SUCCESS,
      data: statusStats
    });

  } catch (error) {
    console.error('Error getting group by status statistics:', error);
    return res.status(500).json({
      message: MESSAGES.GENERAL.SERVER_ERROR,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

export const getTopicStatistics = async (req: Request, res: Response) => {
  try {
    const statistics = await getOverallTopicStats();

    return res.status(200).json({
      message: MESSAGES.GENERAL.ACTION_SUCCESS,
      data: statistics
    });

  } catch (error) {
    console.error('Error getting topic statistics:', error);
    return res.status(500).json({
      message: MESSAGES.GENERAL.SERVER_ERROR,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

export const getTopicByMajorStatistics = async (req: Request, res: Response) => {
  try {
    const topics = await getTopicStatsByMajor();
    
    // Xử lý dữ liệu để nhóm theo ngành
    const majorStats: TopicMajorStatsMap = topics.reduce((acc, topic) => {
      topic.majors.forEach(major => {
        if (!acc[major.name]) {
          acc[major.name] = {
            totalTopics: 0,
            businessTopics: 0,
            researchTopics: 0,
            assignedTopics: 0
          };
        }
        acc[major.name].totalTopics++;
        if (topic.isBusiness) {
          acc[major.name].businessTopics++;
        } else {
          acc[major.name].researchTopics++;
        }
      });
      return acc;
    }, {} as TopicMajorStatsMap);

    // Thêm thông tin về số đề tài đã được gán cho mỗi ngành
    const assignments = await prisma.topicAssignment.findMany({
      where: {
        isDeleted: false,
        status: "ASSIGNED"
      },
      include: {
        topic: {
          include: {
            majors: true
          }
        }
      }
    });

    assignments.forEach(assignment => {
      assignment.topic.majors.forEach(major => {
        if (majorStats[major.name]) {
          majorStats[major.name].assignedTopics++;
        }
      });
    });

    return res.status(200).json({
      message: MESSAGES.GENERAL.ACTION_SUCCESS,
      data: majorStats
    });

  } catch (error) {
    console.error('Error getting topic by major statistics:', error);
    return res.status(500).json({
      message: MESSAGES.GENERAL.SERVER_ERROR,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

export const getTopicByStatusStatistics = async (req: Request, res: Response) => {
  try {
    const statusStats = await getTopicStatsByStatus();

    return res.status(200).json({
      message: MESSAGES.GENERAL.ACTION_SUCCESS,
      data: statusStats
    });

  } catch (error) {
    console.error('Error getting topic by status statistics:', error);
    return res.status(500).json({
      message: MESSAGES.GENERAL.SERVER_ERROR,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

export const getTopicByTypeStatistics = async (req: Request, res: Response) => {
  try {
    const typeStats = await getTopicStatsByType();

    // Chuyển đổi dữ liệu để dễ đọc hơn
    const formattedStats = {
      business: typeStats.find(stat => stat.isBusiness)?._count.isBusiness || 0,
      research: typeStats.find(stat => !stat.isBusiness)?._count.isBusiness || 0
    };

    return res.status(200).json({
      message: MESSAGES.GENERAL.ACTION_SUCCESS,
      data: formattedStats
    });

  } catch (error) {
    console.error('Error getting topic by type statistics:', error);
    return res.status(500).json({
      message: MESSAGES.GENERAL.SERVER_ERROR,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

export const getCouncilTopicStatistics = async (req: Request, res: Response) => {
  try {
    const statistics = await getOverallCouncilTopicStats();

    return res.status(200).json({
      message: MESSAGES.GENERAL.ACTION_SUCCESS,
      data: statistics
    });

  } catch (error) {
    console.error('Error getting council topic statistics:', error);
    return res.status(500).json({
      message: MESSAGES.GENERAL.SERVER_ERROR,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

export const getCouncilTopicBySubmissionPeriodStatistics = async (req: Request, res: Response) => {
  try {
    const statistics = await getCouncilTopicStatsBySubmissionPeriod();

    return res.status(200).json({
      message: MESSAGES.GENERAL.ACTION_SUCCESS,
      data: statistics
    });

  } catch (error) {
    console.error('Error getting council topic by submission period statistics:', error);
    return res.status(500).json({
      message: MESSAGES.GENERAL.SERVER_ERROR,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

export const getCouncilTopicMemberStatistics = async (req: Request, res: Response) => {
  try {
    const statistics = await getCouncilTopicMemberStats();

    return res.status(200).json({
      message: MESSAGES.GENERAL.ACTION_SUCCESS,
      data: statistics
    });

  } catch (error) {
    console.error('Error getting council topic member statistics:', error);
    return res.status(500).json({
      message: MESSAGES.GENERAL.SERVER_ERROR,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

export const getCouncilDefenseStatistics = async (req: Request, res: Response) => {
  try {
    const statistics = await getOverallCouncilDefenseStats();

    return res.status(200).json({
      message: MESSAGES.GENERAL.ACTION_SUCCESS,
      data: statistics
    });

  } catch (error) {
    console.error('Error getting council defense statistics:', error);
    return res.status(500).json({
      message: MESSAGES.GENERAL.SERVER_ERROR,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

// export const getCouncilDefenseByRoundStatistics = async (req: Request, res: Response) => {
//   try {
//     const statistics = await getCouncilDefenseStatsByRound();

//     return res.status(200).json({
//       message: MESSAGES.GENERAL.ACTION_SUCCESS,
//       data: statistics
//     });

//   } catch (error) {
//     console.error('Error getting council defense by round statistics:', error);
//     return res.status(500).json({
//       message: MESSAGES.GENERAL.SERVER_ERROR,
//       error: error instanceof Error ? error.message : 'Unknown error occurred'
//     });
//   }
// };

export const getCouncilDefenseMemberStatistics = async (req: Request, res: Response) => {
  try {
    const statistics = await getCouncilDefenseMemberStats();

    return res.status(200).json({
      message: MESSAGES.GENERAL.ACTION_SUCCESS,
      data: statistics
    });

  } catch (error) {
    console.error('Error getting council defense member statistics:', error);
    return res.status(500).json({
      message: MESSAGES.GENERAL.SERVER_ERROR,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}; 