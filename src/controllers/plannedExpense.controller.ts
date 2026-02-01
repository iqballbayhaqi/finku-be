import { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import prisma from '../utils/prisma';

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

const plannedExpenseSchema = z.object({
  amount: z.coerce.number().positive(),
  date: z.string().datetime(),
  description: z.union([z.string(), z.null()]).optional(),
  categoryId: z.coerce.number(),
  accountId: z.union([z.null(), z.coerce.number()]).optional(),
});

const updatePlannedExpenseSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  date: z.union([z.string().datetime(), z.string()]).optional(),
  description: z.union([z.string(), z.null()]).optional(),
  categoryId: z.coerce.number().optional(),
  accountId: z.union([z.null(), z.coerce.number()]).optional(),
  status: z.enum(['PLANNED', 'EXECUTED', 'CANCELLED']).optional(),
});

export const getPlannedExpenses = async (req: AuthRequest, res: Response) => {
  try {
    const { month, year, status } = req.query;
    
    const whereClause: any = { userId: req.user!.id };
    
    // Filter by month/year if provided
    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 1);
      whereClause.date = {
        gte: startDate,
        lt: endDate
      };
    }
    
    // Filter by status if provided
    if (status) {
      whereClause.status = status;
    }

    const plannedExpenses = await prisma.plannedExpense.findMany({
      where: whereClause,
      include: { 
        category: true,
        account: true,
        transaction: true
      },
      orderBy: { date: 'asc' }
    });

    res.json(plannedExpenses);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createPlannedExpense = async (req: AuthRequest, res: Response) => {
  try {
    const { amount, date, description, categoryId, accountId } = plannedExpenseSchema.parse(req.body);

    const plannedExpense = await prisma.plannedExpense.create({
      data: {
        amount,
        date: new Date(date),
        description,
        categoryId,
        accountId,
        userId: req.user!.id,
      },
      include: { 
        category: true,
        account: true
      },
    });

    res.status(201).json(plannedExpense);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ errors: (error as any).errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updatePlannedExpense = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updatePlannedExpenseSchema.parse(req.body);

    const plannedExpense = await prisma.plannedExpense.findUnique({
      where: { id: Number(id) },
    });

    if (!plannedExpense || plannedExpense.userId !== req.user!.id) {
      return res.status(404).json({ message: 'Planned expense not found' });
    }

    // Build update data - only include defined fields, convert date
    const updateData: any = {};
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.date !== undefined) {
      const parsedDate = new Date(data.date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }
      updateData.date = parsedDate;
    }
    if (data.description !== undefined) updateData.description = data.description;
    if (data.categoryId !== undefined) {
      const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!category || category.userId !== req.user!.id) {
        return res.status(400).json({ message: 'Invalid category' });
      }
      updateData.category = { connect: { id: data.categoryId } };
    }
    if (data.accountId !== undefined) {
      if (data.accountId === null) {
        updateData.account = { disconnect: true };
      } else {
        const account = await prisma.account.findUnique({ where: { id: data.accountId } });
        if (!account || account.userId !== req.user!.id) {
          return res.status(400).json({ message: 'Invalid account' });
        }
        updateData.account = { connect: { id: data.accountId } };
      }
    }
    if (data.status !== undefined) updateData.status = data.status;

    const updated = await prisma.plannedExpense.update({
      where: { id: Number(id) },
      data: updateData,
      include: { 
        category: true,
        account: true
      },
    });

    res.json(updated);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ errors: (error as any).errors });
    }
    if (error?.code === 'P2003') {
      return res.status(400).json({ message: 'Invalid category or account reference' });
    }
    console.error('Update planned expense error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deletePlannedExpense = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const plannedExpense = await prisma.plannedExpense.findUnique({
      where: { id: Number(id) },
    });

    if (!plannedExpense || plannedExpense.userId !== req.user!.id) {
      return res.status(404).json({ message: 'Planned expense not found' });
    }

    await prisma.plannedExpense.delete({
      where: { id: Number(id) },
    });

    res.json({ message: 'Planned expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const executeToTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const plannedExpense = await prisma.plannedExpense.findUnique({
      where: { id: Number(id) },
    });

    if (!plannedExpense || plannedExpense.userId !== req.user!.id) {
      return res.status(404).json({ message: 'Planned expense not found' });
    }

    if (plannedExpense.status === 'EXECUTED') {
      return res.status(400).json({ message: 'Planned expense already executed' });
    }

    // Hanya mengubah status - tidak membuat transaction atau mengubah data lain
    const updatedPlannedExpense = await prisma.plannedExpense.update({
      where: { id: Number(id) },
      data: { status: 'EXECUTED' },
      include: {
        category: true,
        account: true,
      },
    });

    res.json(updatedPlannedExpense);
  } catch (error) {
    console.error('Execute error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
