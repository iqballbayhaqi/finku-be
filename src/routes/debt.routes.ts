import { Router } from 'express';
import multer from 'multer';
import { getDebts, createDebt, updateDebt, deleteDebt, importDebts, getDebtTemplate, exportDebts } from '../controllers/debt.controller';

const upload = multer({ dest: 'uploads/' });
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/template', getDebtTemplate);
router.get('/export', exportDebts);
router.get('/', getDebts);
router.post('/', createDebt);
router.put('/:id', updateDebt);
router.post('/import', upload.single('file'), importDebts);
router.delete('/:id', deleteDebt);

export default router;
