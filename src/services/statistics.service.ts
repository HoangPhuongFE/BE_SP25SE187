import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getStudentQualificationStatisticsService = async (semesterId: string) => {
  const students = await prisma.semesterStudent.findMany({
    where: {
      semesterId,
      isDeleted: false,
    },
    select: {
      qualificationStatus: true,
    },
  });

  const total = students.length;
  let qualified = 0;
  let notQualified = 0;

  for (const s of students) {
    if (s.qualificationStatus === "qualified") qualified++;
    else notQualified++;
  }

  const data = [
    {
      status: "Qualified",
      total: qualified,
      percentage: total ? Math.round((qualified / total) * 100) : 0,
    },
    {
      status: "Not Qualified",
      total: notQualified,
      percentage: total ? Math.round((notQualified / total) * 100) : 0,
    }
  ];

  return { total, data };
};



export const getGroupStatusStatisticsService = async (semesterId: string) => {
  const result = await prisma.group.groupBy({
    by: ["status"],
    where: {
      semesterId,
      isDeleted: false
    },
    _count: { status: true }
  });

  const total = result.reduce((sum, item) => sum + item._count.status, 0);

  const data = result.map(item => ({
    status: item.status,
    total: item._count.status,
    percentage: total === 0 ? 0 : Math.round((item._count.status / total) * 100)
  }));

  return { total, data };
};



export const getTopicStatusStatisticsService = async (semesterId: string) => {
  const result = await prisma.topic.groupBy({
    by: ["status"],
    where: {
      semesterId,
      isDeleted: false
    },
    _count: { status: true }
  });

  const total = result.reduce((sum, item) => sum + item._count.status, 0);

  const data = result.map(item => ({
    status: item.status,
    total: item._count.status,
    percentage: total === 0 ? 0 : Math.round((item._count.status / total) * 100)
  }));

  return {
    total,
    data
  };
};


export const getReviewRoundStatisticsService = async (semesterId: string) => {
  const result = await prisma.reviewAssignment.groupBy({
    by: ["reviewRound"],
    where: {
      isDeleted: false,
      topic: {
        semesterId
      }
    },
    _count: { reviewRound: true }
  });

  const total = result.reduce((sum, item) => sum + item._count.reviewRound, 0);

  const data = result.map(item => ({
    round: `Review ${item.reviewRound}`,
    total: item._count.reviewRound,
    percentage: total === 0 ? 0 : Math.round((item._count.reviewRound / total) * 100)
  }));

  return { total, data };
};


export const getDefenseRoundStatisticsService = async (semesterId: string) => {
  const result = await prisma.defenseSchedule.groupBy({
    by: ["defenseRound"],
    where: {
      isDeleted: false,
      group: {
        semesterId
      }
    },
    _count: { defenseRound: true }
  });

  const total = result.reduce((sum, item) => sum + item._count.defenseRound, 0);

  const data = result.map(item => ({
    round: `Defense ${item.defenseRound}`,
    total: item._count.defenseRound,
    percentage: total === 0 ? 0 : Math.round((item._count.defenseRound / total) * 100)
  }));

  return { total, data };
};



export const getStudentGroupStatusStatisticsService = async (semesterId: string) => {
  const qualifiedStudents = await prisma.semesterStudent.findMany({
    where: {
      semesterId,
      isDeleted: false,
      qualificationStatus: 'qualified' //  chỉ lấy sinh viên ĐỦ điều kiện
    },
    select: {
      studentId: true
    }
  });

  const studentIds = qualifiedStudents.map((s) => s.studentId);

  const groupMembers = await prisma.groupMember.findMany({
    where: {
      studentId: { in: studentIds },
      isDeleted: false
    },
    select: { studentId: true }
  });

  const studentWithGroup = new Set(groupMembers.map((g) => g.studentId));

  const totalWithGroup = studentWithGroup.size;
  const total = studentIds.length;
  const totalWithoutGroup = total - totalWithGroup;

  const data = [
    {
      status: "Has Group",
      total: totalWithGroup,
      percentage: total ? Math.round((totalWithGroup / total) * 100) : 0
    },
    {
      status: "No Group",
      total: totalWithoutGroup,
      percentage: total ? Math.round((totalWithoutGroup / total) * 100) : 0
    }
  ];

  return { total, data };
};



export const getGroupTopicStatusStatisticsService = async (semesterId: string) => {
  const groups = await prisma.group.findMany({
    where: {
      semesterId,
      isDeleted: false
    },
    select: { id: true }
  });

  const groupIds = groups.map((g) => g.id);

  const topicAssignments = await prisma.topicAssignment.findMany({
    where: {
      groupId: { in: groupIds },
      status: "ASSIGNED",
      isDeleted: false
    },
    select: { groupId: true }
  });

  const assignedGroupSet = new Set(topicAssignments.map((ta) => ta.groupId));

  const hasTopic = assignedGroupSet.size;
  const total = groupIds.length;
  const noTopic = total - hasTopic;

  const data = [
    {
      status: "Has Topic",
      total: hasTopic,
      percentage: total === 0 ? 0 : Math.round((hasTopic / total) * 100)
    },
    {
      status: "No Topic",
      total: noTopic,
      percentage: total === 0 ? 0 : Math.round((noTopic / total) * 100)
    }
  ];

  return { total, data };
};

export const getDefenseResultSummaryStatistics = async (semesterId: string) => {
  const results = await prisma.defenseMemberResult.groupBy({
    by: ["result"],
    where: {
      isDeleted: false,
      student: {
        semesterStudents: {
          some: {
            semesterId,
            isDeleted: false,
          },
        },
      },
    },
    _count: { result: true },
  });

  const total = results.reduce((sum, r) => sum + r._count.result, 0);
  return results.map((r) => ({
    status: r.result,
    total: r._count.result,
    percentage: total > 0 ? Math.round((r._count.result / total) * 100) : 0,
  }));
};


export const getDefenseResultByRoundStatistics = async (semesterId: string) => {
  const results = await prisma.defenseMemberResult.groupBy({
    by: ["result", "defenseScheduleId"],
    where: {
      isDeleted: false,
      defenseSchedule: {
        isDeleted: false,
        group: { semesterId },
      },
    },
    _count: { result: true },
  });

  const schedules = await prisma.defenseSchedule.findMany({
    where: {
      isDeleted: false,
      group: { semesterId },
    },
    select: {
      id: true,
      defenseRound: true,
    },
  });

  const roundMap = new Map<string, number>();
  schedules.forEach((s) => roundMap.set(s.id, s.defenseRound));

  const roundStats: Record<number, { PASS: number; NOT_PASS: number }> = {};

  results.forEach((r) => {
    const round = roundMap.get(r.defenseScheduleId) || 0;
    if (!roundStats[round]) roundStats[round] = { PASS: 0, NOT_PASS: 0 };
    roundStats[round][r.result as "PASS" | "NOT_PASS"] += r._count.result;
  });

  return Object.entries(roundStats).map(([round, { PASS, NOT_PASS }]) => {
    const total = PASS + NOT_PASS;
    return {
      round: Number(round),
      PASS,
      NOT_PASS,
      PASS_percentage: total > 0 ? Math.round((PASS / total) * 100) : 0,
      NOT_PASS_percentage: total > 0 ? Math.round((NOT_PASS / total) * 100) : 0,
    };
  });
};


export const getGroupCreationTypeStatisticsService = async (semesterId: string) => {
  const stats = await prisma.group.groupBy({
    by: ['isAutoCreated'],
    where: {
      semesterId,
      isDeleted: false
    },
    _count: {
      _all: true
    }
  });

  const total = stats.reduce((sum, item) => sum + item._count._all, 0);

  const breakdown = [
    {
      type: "Auto Created",
      total: stats.find(s => s.isAutoCreated === true)?._count._all || 0,
      percentage: total === 0 ? 0 : Math.round(((stats.find(s => s.isAutoCreated === true)?._count._all || 0) / total) * 100)
    },
    {
      type: "Manually Created",
      total: stats.find(s => s.isAutoCreated === false)?._count._all || 0,
      percentage: total === 0 ? 0 : Math.round(((stats.find(s => s.isAutoCreated === false)?._count._all || 0) / total) * 100)
    }
  ];

  return {
    totalGroups: total,
    breakdown
  };
};


