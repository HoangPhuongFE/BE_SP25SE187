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
  
    const hasTopic = Array.from(assignedGroupSet).length;
    const noTopic = groupIds.length - hasTopic;
  
    return [
      { status: "Has Topic", total: hasTopic },
      { status: "No Topic", total: noTopic }
    ];
  };
  
  