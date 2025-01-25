import { Request, Response } from 'express';
import { getPaginatedStudents, updateStudent, deleteStudent ,getStudentsBySemesterService } from '../service/student.service';
import { validate as isUUID } from 'uuid';
import { GENERAL_MESSAGE, MESSAGES, STUDENT_MESSAGE } from '../constants/message';

// Hàm lấy danh sách sinh viên
export async function getStudentList(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    const paginatedStudents = await getPaginatedStudents(page, pageSize);

    return res.status(200).json({
      message: MESSAGES.GENERAL.ACTION_SUCCESS,
      data: paginatedStudents,
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    return res.status(500).json({ message: MESSAGES.GENERAL.SERVER_ERROR });
  }
}

// Hàm cập nhật thông tin sinh viên
export const updateStudentHandler = async (req: Request, res: Response) => {
  try {
    const studentId = req.params.studentId;
    const { majorId, specializationId } = req.body;

    if (!isUUID(studentId)) {
      return res.status(400).json({ message: MESSAGES.STUDENT.STUDENT_NOT_FOUND });
    }

    const updatedStudent = await updateStudent(studentId, {
      majorId: parseInt(majorId, 10),
      specializationId: specializationId ? parseInt(specializationId, 10) : null,
    });

    return res.status(200).json({
      message: MESSAGES.STUDENT.STUDENT_UPDATED,
      data: updatedStudent,
    });
  } catch (error) {
    if ((error as any).message === 'Student not found') {
      return res.status(404).json({ message: MESSAGES.STUDENT.STUDENT_NOT_FOUND });
    }
    console.error('Error updating student:', error);
    return res.status(500).json({ message: MESSAGES.GENERAL.SERVER_ERROR });
  }
};

// Hàm xóa sinh viên
export async function deleteStudentHandler(req: Request, res: Response) {
  try {
    const studentId = req.params.studentId;

    if (!isUUID(studentId)) {
      return res.status(400).json({ message: MESSAGES.STUDENT.STUDENT_NOT_FOUND });
    }

    await deleteStudent(studentId);
    return res.status(200).json({ message: MESSAGES.STUDENT.STUDENT_DELETED });
  } catch (error) {
    if ((error as any).message === 'Student not found') {
      return res.status(404).json({ message: MESSAGES.STUDENT.STUDENT_NOT_FOUND });
    }
    console.error('Error deleting student:', error);
    return res.status(500).json({ message: MESSAGES.GENERAL.SERVER_ERROR });
  }
}




export const getStudentsBySemester = async (req: Request, res: Response) => {
  try {
    const { semesterId } = req.params;
    const students = await getStudentsBySemesterService(parseInt(semesterId, 10));

    if (students.length === 0) {
      return res.status(404).json({ message: MESSAGES.STUDENT.STUDENT_LIST_EMPTY });
    }

    return res.status(200).json({ message: STUDENT_MESSAGE.STUDENTS_FETCHED, data: students });
  } catch (error) {
    console.error("Error fetching students by semester:", error);
    return res.status(500).json({ message: GENERAL_MESSAGE.SERVER_ERROR });
  }
};
