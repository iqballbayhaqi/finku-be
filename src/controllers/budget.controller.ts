import { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import prisma from '../utils/prisma';

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

const budgetSchema = z.object({
  amount: z.coerce.number().positive(),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2020),
  categoryId: z.coerce.number(),
});

export const getBudgets = async (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = req.query;
    
    const whereClause: any = { userId: req.user!.id };
    if (month) whereClause.month = Number(month);
    if (year) whereClause.year = Number(year);

    const budgets = await prisma.budget.findMany({
      where: whereClause,
      include: { category: true },
    });

    // Calculate progress for each budget
    const budgetsWithProgress = await Promise.all(budgets.map(async (budget: any) => {
        // Find start and end date of the month
        const startDate = new Date(budget.year, budget.month - 1, 1);
        const endDate = new Date(budget.year, budget.month, 1); // First day of NEXT month

        const expenses = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                userId: req.user!.id,
                categoryId: budget.categoryId,
                type: 'EXPENSE',
                date: {
                    gte: startDate,
                    lt: endDate
                }
            }
        });

        const spent = expenses._sum.amount || 0;
        const percentage = Math.min((spent / budget.amount) * 100, 100);

        return {
            ...budget,
            spent,
            remaining: budget.amount - spent,
            percentage
        };
    }));

    res.json(budgetsWithProgress);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createBudget = async (req: AuthRequest, res: Response) => {
  try {
    const { amount, month, year, categoryId } = budgetSchema.parse(req.body);

    // Check if budget already exists for this category/month/year
    const existingBudget = await prisma.budget.findFirst({
        where: {
            userId: req.user!.id,
            categoryId,
            month,
            year
        }
    });

    if (existingBudget) {
        return res.status(400).json({ message: 'Budget already exists for this category in this period' });
    }

    const budget = await prisma.budget.create({
      data: {
        amount,
        month,
        year,
        categoryId,
        userId: req.user!.id,
      },
      include: { category: true },
    });

    res.status(201).json(budget);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ errors: (error as any).errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteBudget = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
  
      const budget = await prisma.budget.findUnique({
        where: { id: Number(id) },
      });
  
      if (!budget || budget.userId !== req.user!.id) {
        return res.status(404).json({ message: 'Budget not found' });
      }
  
      await prisma.budget.delete({
        where: { id: Number(id) },
      });
  
      res.json({ message: 'Budget deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  };
