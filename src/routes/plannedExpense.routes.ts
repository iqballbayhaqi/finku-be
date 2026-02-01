import { Router } from 'express';
import { 
  getPlannedExpenses, 
  createPlannedExpense, 
  updatePlannedExpense,
  deletePlannedExpense,
  executeToTransaction
} from '../controllers/plannedExpense.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/', getPlannedExpenses);
router.post('/', createPlannedExpense);
router.put('/:id', updatePlannedExpense);
router.delete('/:id', deletePlannedExpense);
router.post('/:id/execute', executeToTransaction);

export default router;
