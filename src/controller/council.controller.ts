import { Request, Response } from 'express'
import { CouncilService } from '../service/council.service'

export class CouncilController {
  // POST /api/councils
  static async createCouncil(req: Request, res: Response) {
    try {
      const { name, type, round, semesterId, status } = req.body
      const council = await CouncilService.createCouncil({
          name, type, round, semesterId, status,
          topicAssId: null
      })
      return res.status(201).json({ success: true, data: council })
    } catch (error) {
      console.error(error)
      const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
      return res.status(500).json({ success: false, message: errorMessage })
    }
  }

  // POST /api/councils/:councilId/members
  static async addMembers(req: Request, res: Response) {
    try {
      const { councilId } = req.params
      const { members } = req.body  // e.g. { members: [ { userId, role }, ... ] }

      const result = await CouncilService.addCouncilMembers(councilId, members)
      return res.status(201).json({
        success: true,
        count: result.count,
        message: 'Members added successfully'
      })
    } catch (error) {
      console.error(error)
      const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
      return res.status(500).json({ success: false, message: errorMessage })
    }
  }

  // GET /api/councils?semesterId=xxx&type=xxx
  static async getCouncils(req: Request, res: Response) {
    try {
      const { semesterId, type } = req.query
      const councils = await CouncilService.getCouncils({
        semesterId: semesterId as string,
        type: type as string
      })
      return res.json({ success: true, data: councils })
    } catch (error) {
      console.error(error)
      const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
      return res.status(500).json({ success: false, message: errorMessage })
    }
  }

  // GET /api/semesters/:semesterId/lecturers/roles
  static async getLecturersRolesInSemester(req: Request, res: Response) {
    try {
      const { semesterId } = req.params
      const result = await CouncilService.getLecturersRolesInSemester(semesterId)
      return res.json({ success: true, data: result })
    } catch (error) {
      console.error(error)
      const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred';
      return res.status(500).json({ success: false, message: errorMessage })
    }
  }
}
