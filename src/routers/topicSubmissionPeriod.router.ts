import express from 'express';
import TopicSubmissionPeriodController from '../controller/topicSubmissionPeriod.controller';
import { authenticateToken, checkRole } from '../middleware/user.middleware';

const router = express.Router();

// Create period
router.post('/', 
    authenticateToken, 
    checkRole(['graduation_thesis_manager']), 
    TopicSubmissionPeriodController.createPeriod
);

// Update period
router.put('/:id', 
    authenticateToken, 
    checkRole(['graduation_thesis_manager']), 
    TopicSubmissionPeriodController.updatePeriod
);

// Delete period
router.delete('/:id', 
    authenticateToken, 
    checkRole(['graduation_thesis_manager']), 
    TopicSubmissionPeriodController.deletePeriod
);

// Get all periods
router.get('/', 
    authenticateToken, 
    TopicSubmissionPeriodController.getAllPeriods
);

// Get active periods
router.get('/active/:semesterId', 
    authenticateToken, 
    TopicSubmissionPeriodController.getActivePeriods
);

// Get period by id
router.get('/:id', 
    authenticateToken, 
    TopicSubmissionPeriodController.getPeriodById
);

export default router; 