
import { Router } from "express";
import { getStudentQualificationStatistics ,
    getGroupStatusStatistics ,
    getTopicStatusStatistics ,
    getReviewRoundStatistics,
    getDefenseRoundStatistics,
    getStudentGroupStatusStatistics,
    getGroupTopicStatusStatistics,

} from "../controllers/statistics.controller";
import {  authenticateToken } from "../middleware/user.middleware";


const router = Router();

//  Thống kê số sinh viên theo tình trạng đạt điều kiện làm khóa luận (qualified / not qualified)
router.get("/student-qualification-status", authenticateToken, getStudentQualificationStatistics);

//  Thống kê số lượng nhóm theo trạng thái (e.g., PENDING, APPROVED, ...)
router.get("/group-statuses",authenticateToken, getGroupStatusStatistics);

//  Thống kê số lượng đề tài theo trạng thái (e.g., PROPOSED, APPROVED, Imporved, ...)
router.get("/topic-statuses",authenticateToken, getTopicStatusStatistics);

//  Thống kê số lượt phản biện theo từng vòng (Review 1, 2, 3)
router.get("/review-rounds",authenticateToken, getReviewRoundStatistics);

//  Thống kê số lượt bảo vệ theo từng vòng (Defense 1, 2)
router.get("/defense-rounds",authenticateToken, getDefenseRoundStatistics);

//  Thống kê số sinh viên đã có nhóm và chưa có nhóm
router.get("/student-group-status",authenticateToken, getStudentGroupStatusStatistics);

//  Thống kê số nhóm đã có đề tài và chưa có đề tài
router.get("/group-topic-status", authenticateToken, getGroupTopicStatusStatistics);

export default router;
