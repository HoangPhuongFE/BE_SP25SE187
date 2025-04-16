import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient(); 

export const getStudentQualificationStatisticsService = async (semesterId: string) => {
    const result = await prisma.semesterStudent.groupBy({
      by: ["qualificationStatus"],
      where: {
        semesterId,
        isDeleted: false
      },
      _count: { qualificationStatus: true }
    });
  
    return result.map(item => ({
      status: item.qualificationStatus === "qualified" ? "Qualified" : "Not Qualified",
      total: item._count.qualificationStatus
    }));
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
  
    return result.map(item => ({
      status: item.status,
      total: item._count.status
    }));
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
  
    return result.map(item => ({
      status: item.status,
      total: item._count.status
    }));
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
  
    return result.map(item => ({
      round: `Review ${item.reviewRound}`,
      total: item._count.reviewRound
    }));
  };
  
  export const getDefenseRoundStatisticsService = async (semesterId: string) => {
    const result = await prisma.defenseSchedule.groupBy({
      by: ["defenseRound"],
      where: {
        isDeleted: false,
        group: {
          semesterId: semesterId
        }
      },
      _count: { defenseRound: true }
    });
  
    return result.map(item => ({
      round: `Defense ${item.defenseRound}`,
      total: item._count.defenseRound
    }));
  };
  

  export const getStudentGroupStatusStatisticsService = async (semesterId: string) => {
    const allStudents = await prisma.semesterStudent.findMany({
      where: {
        semesterId,
        isDeleted: false
      },
      select: {
        studentId: true
      }
    });
  
    const studentIds = allStudents.map((s) => s.studentId);
  
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
  
    return [
      { status: "Has Group", total: totalWithGroup },
      { status: "No Group", total: totalWithoutGroup }
    ];
  };
  

  export const getStudentTopicStatusStatisticsService = async (semesterId: string) => {
    const semesterStudents = await prisma.semesterStudent.findMany({
      where: { semesterId, isDeleted: false },
      select: { studentId: true }
    });
  
    const studentIds = semesterStudents.map((s) => s.studentId);
  
    // B1: Lấy toàn bộ groupMember của các studentId
    const groupMembers = await prisma.groupMember.findMany({
      where: {
        studentId: { in: studentIds },
        isDeleted: false,
        group: {
          semesterId: semesterId
        }
      },
      select: { studentId: true, groupId: true }
    });
  
    const groupMap = new Map<string, string>(); // studentId -> groupId
    groupMembers.forEach((gm) => {
      if (gm.studentId && !groupMap.has(gm.studentId)) {
        groupMap.set(gm.studentId, gm.groupId);
      }
    });
  
    const groupIds = [...new Set(groupMembers.map((gm) => gm.groupId))];
  
    // B2: Lấy danh sách group có topic được assign
    const assignedTopics = await prisma.topicAssignment.findMany({
      where: {
        groupId: { in: groupIds },
        isDeleted: false,
        status: "ASSIGNED"
      },
      select: { groupId: true }
    });
  
    const assignedGroupIds = new Set(assignedTopics.map((ta) => ta.groupId));
  
    // B3: Phân loại sinh viên có/không đề tài
    let hasTopic = 0;
    let noTopic = 0;
  
    semesterStudents.forEach((ss) => {
      const groupId = groupMap.get(ss.studentId);
      if (groupId && assignedGroupIds.has(groupId)) {
        hasTopic++;
      } else {
        noTopic++;
      }
    });
  
    return [
      { status: "Has Topic", total: hasTopic },
      { status: "No Topic", total: noTopic }
    ];
  };
  