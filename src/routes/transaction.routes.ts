import { Router } from 'express';
import { getTransactions, createTransaction, deleteTransaction, exportTransactions } from '../controllers/transaction.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/', getTransactions);
router.get('/export', exportTransactions);
router.post('/', createTransaction);
router.delete('/:id', deleteTransaction);

export default router;
