import express from 'express';
import TopicSubmissionPeriodController from '../controller/topicSubmissionPeriod.controller';
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const router = express.Router();

// Các route yêu cầu xác thực và quyền Graduation Thesis Manager
router.post('/', 
    authenticateToken, 
    checkRole(['GRADUATION_THESIS_MANAGER']), 
    TopicSubmissionPeriodController.createPeriod
);

router.put('/:id', 
    authenticateToken, 
    checkRole(['GRADUATION_THESIS_MANAGER']), 
    TopicSubmissionPeriodController.updatePeriod
);

router.delete('/:id', 
    authenticateToken, 
    checkRole(['GRADUATION_THESIS_MANAGER']), 
    TopicSubmissionPeriodController.deletePeriod
);

// Các route chỉ yêu cầu xác thực
router.get('/', 
    authenticateToken, 
    TopicSubmissionPeriodController.getAllPeriods
);

router.get('/active/:semesterId', 
    authenticateToken, 
    TopicSubmissionPeriodController.getActivePeriods
);

router.get('/:id', 
    authenticateToken, 
    TopicSubmissionPeriodController.getPeriodById
);

export default router; 