import { Request, Response } from "express";
import { StudentService } from "../services/student.service";
import { MESSAGES, STUDENT_MESSAGE, GENERAL_MESSAGE } from "../constants/message";

export class StudentController {
  private studentService = new StudentService();

 

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
  


}
