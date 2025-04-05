import { Request, Response } from "express";
import { StudentService } from "../services/student.service";
import { MESSAGES, STUDENT_MESSAGE, GENERAL_MESSAGE } from "../constants/message";

export class StudentController {
  private studentService = new StudentService();

  // Lấy danh sách sinh viên (phân trang)
  async getStudentList(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;

      const paginatedStudents = await this.studentService.getPaginatedStudents(page, pageSize);

      return res.status(200).json({
        message: MESSAGES.GENERAL.ACTION_SUCCESS,
        data: paginatedStudents,
      });
    } catch (error) {
      console.error("Error fetching students:", error);
      return res.status(500).json({ message: MESSAGES.GENERAL.SERVER_ERROR });
    }
  }

  // Cập nhật student
  async updateStudentHandler(req: Request, res: Response) {
    try {
      const studentId = req.params.studentId;
      const { majorId, specializationId } = req.body;

      const updatedStudent = await this.studentService.updateStudent(studentId, {
        majorId: parseInt(majorId, 10).toString(),
        specializationId: specializationId || null,
      });

      return res.status(200).json({
        message: MESSAGES.STUDENT.STUDENT_UPDATED,
        data: updatedStudent,
      });
    } catch (error) {
      if ((error as Error).message === "Student not found") {
        return res.status(404).json({ message: MESSAGES.STUDENT.STUDENT_NOT_FOUND });
      }
      console.error("Error updating student:", error);
      return res.status(500).json({ message: MESSAGES.GENERAL.SERVER_ERROR });
    }
  }

  // Xoá student theo studentId
async deleteStudentHandler(req: Request, res: Response) {
  try {
    const studentId = req.params.studentId;

    // Kiểm tra nếu studentId không hợp lệ
    if (!studentId || typeof studentId !== "string") {
      return res.status(400).json({ message: "Invalid studentId" });
    }

    await this.studentService.deleteStudent(studentId);
    
    return res.status(200).json({
      message: MESSAGES.STUDENT.STUDENT_DELETED,
    });
  } catch (error) {
    if ((error as Error).message === "Student not found") {
      return res.status(404).json({ message: MESSAGES.STUDENT.STUDENT_NOT_FOUND });
    }
    console.error("Error deleting student:", error);
    return res.status(500).json({ message: MESSAGES.GENERAL.SERVER_ERROR });
  }
}


  // Lấy danh sách student theo Semester
  async getStudentsBySemester(req: Request, res: Response) {
    try {
      const { semesterId } = req.params;
      const students = await this.studentService.getStudentsBySemester(semesterId);
  
      return res.status(200).json({
        data: students,
      });
    } catch (error) {
      console.error("Error fetching students by semester:", error);
      return res.status(500).json({ message: GENERAL_MESSAGE.SERVER_ERROR });
    }
  }
  
// Xoá tất cả sinh viên trong semester 
async deleteAllStudentsBySemesterHandler(req: Request, res: Response) {
  const { semesterId } = req.params;

  if (!semesterId) {
    return res.status(400).json({ message: "Missing semesterId." });
  }

  try {
    const result = await this.studentService.deleteAllStudentsInSemester(semesterId);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in deleteAllStudentsBySemesterHandler:", error);
    return res.status(500).json({ message: "Failed to delete all students in the semester." });
  }
}

}
