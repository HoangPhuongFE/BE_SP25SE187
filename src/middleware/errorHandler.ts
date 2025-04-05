import { Request, Response, NextFunction } from "express";

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  let statusCode = 500;
  let message = "Đã xảy ra lỗi không xác định.";

  if (err instanceof Error) {
    message = err.message;
    statusCode = (err as any).statusCode || 500;
  }

  res.status(statusCode).json({ message });
}
