import express from 'express';
import { 
  getReview1Statistics, 
  getReview2Statistics, 
  getReview3Statistics,
  getGroupStatistics,
  getGroupByMajorStatistics,
  getGroupByStatusStatistics,
  getTopicStatistics,
  getTopicByMajorStatistics,
  getTopicByStatusStatistics,
  getTopicByTypeStatistics,
  getCouncilTopicStatistics,
  getCouncilTopicBySubmissionPeriodStatistics,
  getCouncilTopicMemberStatistics,
  getCouncilDefenseStatistics,
  //getCouncilDefenseByRoundStatistics,
  getCouncilDefenseMemberStatistics
} from '../controllers/statistics.controller';
import { authenticateToken } from '../middleware/user.middleware';

const router = express.Router();

// Review statistics routes
router.get('/review1', authenticateToken, getReview1Statistics);
router.get('/review2', authenticateToken, getReview2Statistics);
router.get('/review3', authenticateToken, getReview3Statistics);

// Group statistics routes
router.get('/groups', authenticateToken, getGroupStatistics);
router.get('/groups/major', authenticateToken, getGroupByMajorStatistics);
router.get('/groups/status', authenticateToken, getGroupByStatusStatistics);

// Topic statistics routes
router.get('/topics', authenticateToken, getTopicStatistics);
router.get('/topics/major', authenticateToken, getTopicByMajorStatistics);
router.get('/topics/status', authenticateToken, getTopicByStatusStatistics);
router.get('/topics/type', authenticateToken, getTopicByTypeStatistics);

// Council Topic statistics routes
router.get('/council-topics', authenticateToken, getCouncilTopicStatistics);
router.get('/council-topics/submission-period', authenticateToken, getCouncilTopicBySubmissionPeriodStatistics);
router.get('/council-topics/members', authenticateToken, getCouncilTopicMemberStatistics);

// Council Defense statistics routes
router.get('/council-defense', authenticateToken, getCouncilDefenseStatistics);
//router.get('/council-defense/round', authenticateToken, getCouncilDefenseByRoundStatistics);
router.get('/council-defense/members', authenticateToken, getCouncilDefenseMemberStatistics);

export default router; 