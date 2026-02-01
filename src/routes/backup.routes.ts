import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { exportData } from '../controllers/backup.controller';

const router = express.Router();

router.get('/export', authenticateToken, exportData);
import { restoreData } from '../controllers/backup.controller';
router.post('/restore', authenticateToken, restoreData);

export default router;
