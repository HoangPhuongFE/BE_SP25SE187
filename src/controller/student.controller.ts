import { Request, Response } from 'express';
import { getPaginatedStudents } from '../service/student.service';

export async function getStudentList(req: Request, res: Response) {
  try {
    // Lấy page và pageSize từ query params, mặc định nếu không truyền
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    // Gọi service để lấy dữ liệu với phân trang
    const paginatedStudents = await getPaginatedStudents(page, pageSize);

    res.status(200).json(paginatedStudents);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Failed to fetch students' });
  }
}
