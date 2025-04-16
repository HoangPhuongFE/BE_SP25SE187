
import { Router } from "express";
import { getStudentQualificationStatistics ,
    getGroupStatusStatistics ,
    getTopicStatusStatistics ,
    getReviewRoundStatistics,
    getDefenseRoundStatistics,
    getStudentGroupStatusStatistics,
    getStudentTopicStatusStatistics,

} from "../controllers/statistics.controller";
import {  authenticateToken } from "../middleware/user.middleware";


const router = Router();

//  Thống kê số sinh viên theo tình trạng đạt điều kiện làm khóa luận (qualified / not qualified)
router.get("/student-qualification-status", authenticateToken, getStudentQualificationStatistics);

//  Thống kê số lượng nhóm theo trạng thái (e.g., PENDING, APPROVED, ...)
router.get("/group-statuses", getGroupStatusStatistics);

//  Thống kê số lượng đề tài theo trạng thái (e.g., PROPOSED, APPROVED, DUPLICATED, ...)
router.get("/topic-statuses", getTopicStatusStatistics);

//  Thống kê số lượt phản biện theo từng vòng (Review 1, 2, 3)
router.get("/review-rounds", getReviewRoundStatistics);

//  Thống kê số lượt bảo vệ theo từng vòng (Defense 1, 2)
router.get("/defense-rounds", getDefenseRoundStatistics);

//  Thống kê số sinh viên đã có nhóm và chưa có nhóm
router.get("/student-group-status", getStudentGroupStatusStatistics);

//  Thống kê số sinh viên đã có đề tài và chưa có đề tài
router.get("/student-topic-status", getStudentTopicStatusStatistics);

export default router;
