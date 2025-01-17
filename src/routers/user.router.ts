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
  checkRole(['student', 'lecturer', 'head_of_department', 'dean', 'reviewer', 'mentor', 'chairman', 'secretary']), 
  userController.updateProfile
);

router.get('/profile', 
  authenticateToken, 
  checkRole(['student', 'lecturer', 'head_of_department', 'dean', 'reviewer', 'mentor', 'chairman', 'secretary']), 
  userController.getProfile
);

export default router;
