import { Router } from 'express';
import { getBudgets, createBudget, deleteBudget } from '../controllers/budget.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/', getBudgets);
router.post('/', createBudget);
router.delete('/:id', deleteBudget);

export default router;
