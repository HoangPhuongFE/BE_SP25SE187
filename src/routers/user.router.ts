import { Router } from 'express';
import { UserController } from '../controller/user.controller';
import { validateRegister, validateLogin, authenticateToken, checkRole } from '../middleware/user.middleware';

const router = Router();
const userController = new UserController();

router.post('/register', validateRegister, userController.register);
router.post('/login', validateLogin, userController.login);
router.post('/google-login', userController.googleLogin);
router.post('/logout', authenticateToken, userController.logout);
router.put('/profile', 
  authenticateToken, 
  checkRole(['student', 'lecturer', 'academic_officer', 'graduation_thesis_manager','dean', 'reviewer', 'mentor', 'chairman', 'secretary']), 
  userController.updateProfile
);

router.get('/profile', 
  authenticateToken, 
  checkRole(['student', 'lecturer', 'academic_officer','graduation_thesis_manager', 'dean', 'reviewer', 'mentor', 'chairman', 'secretary']), 
  userController.getProfile
);

router.get('/users',
  authenticateToken,
  checkRole(['admin', 'academic_officer','graduation_thesis_manager', 'dean','lecturer', 'reviewer', 'mentor', 'chairman',]), 
  userController.getUsers
);


router.get('/users/:id',
  authenticateToken,
  checkRole(['admin', 'academic_officer','graduation_thesis_manager', 'dean','lecturer', 'reviewer', 'mentor', 'chairman',]), 
   userController.getUserById
);


export default router;
