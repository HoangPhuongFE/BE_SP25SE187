import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { validateRegister, validateLogin, authenticateToken, checkRole } from '../middleware/user.middleware';

const router = Router();
const userController = new UserController();

router.post('/register', validateRegister, userController.register);
router.post('/login', validateLogin, userController.login);
router.post('/logout', authenticateToken, userController.logout);

router.put('/profile', 
  authenticateToken, 
  checkRole(['student', 'examination_officer','lecturer', 'academic_officer', 'graduation_thesis_manager','', 'reviewer', 'mentor', 'chairman', 'secretary','lecturer'],false), 
  userController.updateProfile
);



router.get('/profile', 
  authenticateToken, 
  checkRole(['admin', 'academic_officer','graduation_thesis_manager', 'lecturer', "student","leader"],false), 
  userController.getProfile
);

router.get('/users',
  authenticateToken,
  checkRole(['admin', 'academic_officer','graduation_thesis_manager', 'lecturer', "student","leader"],false), 
  userController.getUsers
);


router.get('/users/:id',
  authenticateToken,
  checkRole(['admin', 'academic_officer','graduation_thesis_manager', 'dean','lecturer', 'reviewer', 'mentor', 'chairman',"student","leader","secretary"]), 
   userController.getUserById
);


export default router;
