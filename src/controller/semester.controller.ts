import { Request, Response } from "express";
import {
  getSemestersByYearService,
  createSemesterService,
  updateSemesterService,
  deleteSemesterService,
} from "../service/semester.service";
import { SEMESTER_MESSAGE, GENERAL_MESSAGE , MESSAGES } from "../constants/message";



export const getSemestersByYear = async (req: Request, res: Response) => {
  try {
    const { yearId } = req.params;
    const { page = 1, pageSize = 10 } = req.query;

    if (!yearId || isNaN(Number(yearId))) {
      return res.status(400).json({ message: SEMESTER_MESSAGE.INVALID_SEMESTER_ID });
    }

    const result = await getSemestersByYearService(
      parseInt(yearId, 10),
      Number(page),
      Number(pageSize)
    );

    return res.status(200).json({
      message: SEMESTER_MESSAGE.SEMESTERS_FETCHED,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching semesters:", error);
    return res.status(500).json({ message: GENERAL_MESSAGE.SERVER_ERROR });
  }
};


export const createSemester = async (req: Request, res: Response) => {
  try {
    const { yearId, code, startDate, endDate, registrationDeadline, status } = req.body;
    const semester = await createSemesterService(
      parseInt(yearId, 10),
      code,
      new Date(startDate),
      new Date(endDate),
      new Date(registrationDeadline),
      status
    );
    return res.status(201).json({ message: SEMESTER_MESSAGE.SEMESTER_CREATED, data: semester });
  } catch (error) {
    console.error("Error creating semester:", error);
    return res.status(500).json({ message: GENERAL_MESSAGE.SERVER_ERROR });
  }
};

export const updateSemester = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { code, startDate, endDate, registrationDeadline, status } = req.body;
    const semester = await updateSemesterService(
      parseInt(id, 10),
      code,
      new Date(startDate),
      new Date(endDate),
      new Date(registrationDeadline),
      status
    );
    return res.status(200).json({ message: SEMESTER_MESSAGE.SEMESTER_UPDATED, data: semester });
  } catch (error) {
    console.error("Error updating semester:", error);
    return res.status(500).json({ message: GENERAL_MESSAGE.SERVER_ERROR });
  }
};

export const deleteSemester = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const semester = await deleteSemesterService(parseInt(id, 10));
    return res.status(200).json({ message: SEMESTER_MESSAGE.SEMESTER_DELETED, data: semester });
  } catch (error) {
    console.error("Error deleting semester:", error);
    return res.status(500).json({ message: GENERAL_MESSAGE.SERVER_ERROR });
  }
};
