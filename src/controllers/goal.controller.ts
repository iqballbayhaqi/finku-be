import { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import prisma from '../utils/prisma';

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

const goalSchema = z.object({
  name: z.string().min(1),
  targetAmount: z.number().positive(),
  currentAmount: z.number().min(0).default(0),
  imageUrl: z.string().optional(),
  deadline: z.union([z.string(), z.null()]).optional(), // ISO Date string or null
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('IN_PROGRESS'),
  accountId: z.coerce.number().optional(),
});

export const getGoals = async (req: AuthRequest, res: Response) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { userId: req.user!.id },
      include: { 
        account: true,
        linkedAccounts: true 
      },
      orderBy: { createdAt: 'desc' },
    });

    const goalsWithTotal = goals.map((goal: any) => {
        let calculatedAmount = goal.currentAmount;
        if (goal.linkedAccounts && goal.linkedAccounts.length > 0) {
            calculatedAmount = goal.linkedAccounts.reduce((sum: number, acc: any) => sum + acc.balance, 0);
        } else if (goal.accountId && goal.account) {
            calculatedAmount = goal.account.balance;
        }
        return {
            ...goal,
            currentAmount: calculatedAmount 
        };
    });

    res.json(goalsWithTotal);
  } catch (error) {
    console.error('Error in getGoals:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createGoal = async (req: AuthRequest, res: Response) => {
  try {
    const parsed = goalSchema.parse(req.body);
    let { name, targetAmount, currentAmount, imageUrl, deadline, status, accountId } = parsed;

    if (accountId) {
      const account = await prisma.account.findFirst({
        where: { id: Number(accountId), userId: req.user!.id },
      });
      if (account) currentAmount = account.balance;
    }

    const goal = await prisma.goal.create({
      data: {
        name,
        targetAmount,
        currentAmount,
        imageUrl,
        deadline: deadline ? new Date(deadline) : null,
        status,
        userId: req.user!.id,
        accountId: accountId ? Number(accountId) : null,
      },
      include: { account: true },
    });

    res.status(201).json(goal);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ errors: (error as any).errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateGoal = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = goalSchema.parse(req.body);
    let { name, targetAmount, currentAmount, imageUrl, deadline, status, accountId } = parsed;

    const goal = await prisma.goal.findUnique({
      where: { id: Number(id) },
    });

    if (!goal || goal.userId !== req.user!.id) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    if (accountId) {
      const account = await prisma.account.findFirst({
        where: { id: Number(accountId), userId: req.user!.id },
      });
      if (account) currentAmount = account.balance;
    }

    const updatedGoal = await prisma.goal.update({
      where: { id: Number(id) },
      data: {
        name,
        targetAmount,
        currentAmount,
        imageUrl,
        deadline: deadline ? new Date(deadline) : null,
        status,
        accountId: accountId ? Number(accountId) : null,
      },
      include: { account: true },
    });

    res.json(updatedGoal);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ errors: (error as any).errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteGoal = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const goal = await prisma.goal.findUnique({
      where: { id: Number(id) },
    });

    if (!goal || goal.userId !== req.user!.id) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    await prisma.goal.delete({
      where: { id: Number(id) },
    });

    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};
