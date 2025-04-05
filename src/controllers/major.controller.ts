// src/controller/major.controller.ts
import { Request, Response } from "express";
import HTTP_STATUS from "../constants/httpStatus";
import { MajorService } from "../services/major.service";

export class MajorController {
  private majorService: MajorService;

  constructor() {
    this.majorService = new MajorService();
  }

  getAllMajors = async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const search = req.query.search as string;

      const result = await this.majorService.getAllMajors({
        page,
        pageSize,
        search
      });

      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        message: (error as Error).message
      });
    }
  }
}