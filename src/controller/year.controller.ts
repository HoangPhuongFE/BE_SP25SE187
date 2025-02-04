import { Request, Response } from "express";

import {
  getAllYearsService,
  createYearService,
  updateYearService,
  deleteYearService,
} from "../service/year.service";
import { YEAR_MESSAGE, GENERAL_MESSAGE } from "../constants/message";




export const getAllYears = async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 10 } = req.query;

    const result = await getAllYearsService(Number(page), Number(pageSize));

    return res.status(200).json({
      message: YEAR_MESSAGE.YEAR_FETCHED,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching years:", error);
    return res.status(500).json({ message: GENERAL_MESSAGE.SERVER_ERROR });
  }
};


export const createYear = async (req: Request, res: Response) => {
    try {
      const { year } = req.body;
  
      // Kiểm tra dữ liệu đầu vào
      if (!year || typeof year !== 'number') {
        return res.status(400).json({ message: 'Year is required and must be a number.' });
      }
  
      
      const createdYear = await createYearService(year);
      return res.status(201).json({ message: YEAR_MESSAGE.YEAR_CREATED, data: createdYear });
    } catch (error) {
      console.error("Error creating year:", error);
      return res.status(500).json({ message: GENERAL_MESSAGE.SERVER_ERROR });
    }
  };
  
  export const updateYear = async (req: Request, res: Response) => {
    try {
      const { id } = req.params; 
      const { year } = req.body; 
  
     
      if (!id || isNaN(Number(id))) {
        return res.status(400).json({ message: 'Invalid ID parameter.' });
      }
      if (!year || typeof year !== 'number') {
        return res.status(400).json({ message: 'Year is required and must be a number.' });
      }
  
     
      const updatedYear = await updateYearService(id, year); 
            return res.status(200).json({ message: YEAR_MESSAGE.YEAR_UPDATED, data: updatedYear });
    } catch (error) {
      console.error("Error updating year:", error);
      return res.status(500).json({ message: GENERAL_MESSAGE.SERVER_ERROR });
    }
  };
  
export const deleteYear = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const year = await deleteYearService(id); 
    return res.status(200).json({ message: YEAR_MESSAGE.YEAR_DELETED, data: year });
  } catch (error) {
    console.error("Error deleting year:", error);
    return res.status(500).json({ message: GENERAL_MESSAGE.SERVER_ERROR });
  }
};
