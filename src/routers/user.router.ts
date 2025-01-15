import { Router } from 'express';
import { UserController } from '../controller/user.controller';
import { validateRegister, validateLogin, authenticateToken } from '../middleware/user.middleware';

const router = Router();
const userController = new UserController();

router.post('/register', validateRegister, userController.register);
router.post('/login', validateLogin, userController.login);
router.post('/google-login', userController.googleLogin);

// Protected routes example
router.get('/profile', authenticateToken, userController.getProfile);

export default router;
