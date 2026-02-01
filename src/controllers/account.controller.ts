import { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import prisma from '../utils/prisma';

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

const accountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['BANK', 'E_WALLET', 'CASH', 'OTHER', 'REKSADANA', 'SAHAM', 'CRYPTO']),
  balance: z.number().default(0),
  stockSymbol: z.string().optional(),
  quantity: z.number().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  goalId: z.number().optional().nullable(),
});

export const getAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createAccount = async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, balance, stockSymbol, quantity, imageUrl, goalId } = accountSchema.parse(req.body);

    const account = await prisma.account.create({
      data: {
        name,
        type,
        balance,
        stockSymbol,
        quantity,
        imageUrl,
        goalId: goalId ? Number(goalId) : null,
        userId: req.user!.id,
      },
    });

    res.status(201).json(account);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ errors: (error as any).errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateAccount = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, balance, stockSymbol, quantity, imageUrl, goalId } = accountSchema.parse(req.body);

    const account = await prisma.account.findUnique({
      where: { id: Number(id) },
    });

    if (!account || account.userId !== req.user!.id) {
      return res.status(404).json({ message: 'Account not found' });
    }

    const updatedAccount = await prisma.account.update({
      where: { id: Number(id) },
      data: { name, type, balance, stockSymbol, quantity, imageUrl, goalId: goalId ? Number(goalId) : null },
    });

    res.json(updatedAccount);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ errors: (error as any).errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteAccount = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const account = await prisma.account.findUnique({
      where: { id: Number(id) },
    });

    if (!account || account.userId !== req.user!.id) {
      return res.status(404).json({ message: 'Account not found' });
    }

    // Check if account has transactions
    const transactionCount = await prisma.transaction.count({
        where: { accountId: Number(id) }
    });

    if (transactionCount > 0) {
        return res.status(400).json({ message: 'Cannot delete account with associated transactions' });
    }

    await prisma.account.delete({
      where: { id: Number(id) },
    });

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};
