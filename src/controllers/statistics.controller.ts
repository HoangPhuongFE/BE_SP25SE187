import { Request, Response } from "express";
import { getStudentQualificationStatisticsService ,
  getGroupStatusStatisticsService,
  getTopicStatusStatisticsService,
  getReviewRoundStatisticsService,
  getDefenseRoundStatisticsService,
  getStudentGroupStatusStatisticsService,
  getStudentTopicStatusStatisticsService,
  
 } from "../services/statistics.service";

export const getStudentQualificationStatistics = async (req: Request, res: Response) => {
  try {
    const semesterId = req.query.semesterId?.toString();
    if (!semesterId) return res.status(400).json({ message: "semesterId is required" });

    const stats = await getStudentQualificationStatisticsService(semesterId);
    return res.json(stats);
  } catch (error) {
    console.error("Error in getStudentQualificationStatistics:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};



export const getGroupStatusStatistics = async (req: Request, res: Response) => {
  try {
    const semesterId = req.query.semesterId?.toString();
    if (!semesterId) return res.status(400).json({ message: "semesterId is required" });

    const stats = await getGroupStatusStatisticsService(semesterId);
    return res.json(stats);
  } catch (error) {
    console.error("Error in getGroupStatusStatistics:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getTopicStatusStatistics = async (req: Request, res: Response) => {
  try {
    const semesterId = req.query.semesterId?.toString();
    if (!semesterId) return res.status(400).json({ message: "semesterId is required" });

    const stats = await getTopicStatusStatisticsService(semesterId);
    return res.json(stats);
  } catch (error) {
    console.error("Error in getTopicStatusStatistics:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};



export const getReviewRoundStatistics = async (req: Request, res: Response) => {
  try {
    const semesterId = req.query.semesterId?.toString();
    if (!semesterId) return res.status(400).json({ message: "semesterId is required" });

    const stats = await getReviewRoundStatisticsService(semesterId);
    return res.json(stats);
  } catch (error) {
    console.error("Error in getReviewRoundStatistics:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


export const getDefenseRoundStatistics = async (req: Request, res: Response) => {
  try {
    const semesterId = req.query.semesterId?.toString();
    if (!semesterId) return res.status(400).json({ message: "semesterId is required" });

    const stats = await getDefenseRoundStatisticsService(semesterId);
    return res.json(stats);
  } catch (error) {
    console.error("Error in getDefenseRoundStatistics:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


export const getStudentGroupStatusStatistics = async (req: Request, res: Response) => {
  try {
    const semesterId = req.query.semesterId?.toString();
    if (!semesterId) return res.status(400).json({ message: "semesterId is required" });

    const stats = await getStudentGroupStatusStatisticsService(semesterId);
    return res.json(stats);
  } catch (error) {
    console.error("Error in getStudentGroupStatusStatistics:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


export const getStudentTopicStatusStatistics = async (req: Request, res: Response) => {
  try {
    const semesterId = req.query.semesterId?.toString();
    if (!semesterId) return res.status(400).json({ message: "semesterId is required" });

    const stats = await getStudentTopicStatusStatisticsService(semesterId);
    return res.json(stats);
  } catch (error) {
    console.error("Error in getStudentTopicStatusStatistics:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
