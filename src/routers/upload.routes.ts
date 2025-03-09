import { Router } from 'express';
import { uploadFile } from '../middleware/upload';

const router = Router();

router.post('/', uploadFile);

export default router;