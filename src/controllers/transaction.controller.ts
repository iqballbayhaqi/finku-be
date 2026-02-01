import { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import prisma from '../utils/prisma';

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

const transactionSchema = z.object({
  amount: z.coerce.number().positive(),
  date: z.string(), // ISO String
  description: z.string().optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
  categoryId: z.coerce.number(),
  accountId: z.union([z.null(), z.coerce.number()]).optional(),
  targetAccountId: z.union([z.null(), z.coerce.number()]).optional(),
  goalId: z.union([z.null(), z.coerce.number()]).optional(),
  debtId: z.union([z.null(), z.coerce.number()]).optional(),
});

export const getTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, type, categoryId } = req.query;

    const whereClause: any = {
      userId: req.user!.id,
    };

    if (startDate && endDate) {
        whereClause.date = {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string),
        };
    }

    if (type) {
        whereClause.type = type as string;
    }

    if (categoryId) {
        whereClause.categoryId = Number(categoryId);
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      include: { category: true, account: true, targetAccount: true, debt: true },
      orderBy: { date: 'desc' },
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const { amount, date, description, type, categoryId, accountId, targetAccountId, goalId, debtId } = transactionSchema.parse(req.body);

    // Verify category ownership
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || category.userId !== req.user!.id) {
        return res.status(400).json({ message: 'Invalid category' });
    }

    // Logic for TRANSFER
    if (type === 'TRANSFER') {
        if (!accountId || !targetAccountId) {
            return res.status(400).json({ message: 'Source and Target accounts are required for Transfer' });
        }
        if (accountId === targetAccountId) {
            return res.status(400).json({ message: 'Cannot transfer to the same account' });
        }

        const sourceAccount = await prisma.account.findUnique({ where: { id: accountId } });
        const targetAccount = await prisma.account.findUnique({ where: { id: targetAccountId } });

        if (!sourceAccount || sourceAccount.userId !== req.user!.id || !targetAccount || targetAccount.userId !== req.user!.id) {
            return res.status(400).json({ message: 'Invalid source or target account' });
        }

        // Atomic Transaction for Transfer
        const result = await prisma.$transaction(async (tx: any) => {
             // 1. Deduct from Source
             await tx.account.update({
                 where: { id: accountId },
                 data: { balance: { decrement: amount } }
             });
             // 2. Add to Target
             await tx.account.update({
                 where: { id: targetAccountId },
                 data: { balance: { increment: amount } }
             });
             // 3. Create Transaction Record
             return await tx.transaction.create({
                 data: {
                     amount,
                     date: new Date(date),
                     description,
                     type,
                     categoryId,
                     accountId,
                     targetAccountId,
                     userId: req.user!.id,
                 },
                 include: { category: true, account: true, targetAccount: true }
             });
        });

        return res.status(201).json(result);
    }

    // Handle Balance Update if Account is linked (Normal Income/Expense)
    if (accountId) {
        const account = await prisma.account.findUnique({ where: { id: accountId } });
        if (!account || account.userId !== req.user!.id) {
            return res.status(400).json({ message: 'Invalid account' });
        }
        
        // Update balance
        const balanceChange = type === 'INCOME' ? amount : -amount;
        await prisma.account.update({
            where: { id: accountId },
            data: { balance: { increment: balanceChange } }
        });
    }

    // Handle Goal Update if Goal is linked
    if (goalId) {
        const goal = await prisma.goal.findUnique({ where: { id: goalId } });
        if (!goal || goal.userId !== req.user!.id) {
            return res.status(400).json({ message: 'Invalid goal' });
        }

        // Logic: INCOME (Saving) adds to currentAmount, EXPENSE (Withdrawal) subtracts
        // Usually linking goal implies saving, so INCOME is typical.
        const amountChange = type === 'INCOME' ? amount : -amount;
        await prisma.goal.update({
            where: { id: goalId },
            data: { currentAmount: { increment: amountChange } }
        });
    }

    // Handle Debt Link if linked
    if (debtId) {
        const debt = await prisma.debt.findUnique({ where: { id: debtId } });
        if (!debt || debt.userId !== req.user!.id) {
             return res.status(400).json({ message: 'Invalid debt' });
        }

        // Jika debt bertipe cicilan (punya totalInstallments), naikkan currentInstallment +1
        if (debt.totalInstallments != null && debt.totalInstallments > 0) {
            const newCurrent = (debt.currentInstallment ?? 0) + 1;
            await prisma.debt.update({
                where: { id: debtId },
                data: {
                    currentInstallment: newCurrent,
                    // Auto-mark PAID jika sudah mencapai cicilan terakhir
                    ...(newCurrent >= debt.totalInstallments ? { status: 'PAID' } : {}),
                },
            });
        }
    }

    const transaction = await prisma.transaction.create({
      data: {
        amount,
        date: new Date(date),
        description,
        type,
        categoryId,
        accountId,
        goalId,
        debtId,
        userId: req.user!.id,
      } as any,
      include: { category: true },
    });

    res.status(201).json(transaction);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ errors: (error as any).errors });
    }
    // console.log(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteTransaction = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
  
      const transaction = await prisma.transaction.findUnique({
        where: { id: Number(id) },
      });
  
      if (!transaction || transaction.userId !== req.user!.id) {
        return res.status(404).json({ message: 'Transaction not found' });
      }

      // Revert Transfer
      if (transaction.type === 'TRANSFER' && (transaction as any).targetAccountId && (transaction as any).accountId) {
           await prisma.$transaction(async (tx: any) => {
               // Revert Source (Add back)
               await tx.account.update({
                   where: { id: (transaction as any).accountId },
                   data: { balance: { increment: transaction.amount } }
               });
               // Revert Target (Deduct)
               await tx.account.update({
                   where: { id: (transaction as any).targetAccountId },
                   data: { balance: { decrement: transaction.amount } }
               });
               // Delete Transaction
               await tx.transaction.delete({ where: { id: Number(id) } });
           });
           return res.json({ message: 'Transfer deleted successfully' });
      }

      // Revert Balance if account linked (Income/Expense)
      if ((transaction as any).accountId) {
          const revertAmount = transaction.type === 'INCOME' ? -transaction.amount : transaction.amount;
          await prisma.account.update({
              where: { id: (transaction as any).accountId },
              data: { balance: { increment: revertAmount } }
          });
      }

      // Revert Goal Balance if goal linked
      if ((transaction as any).goalId) {
          const revertGoalAmount = transaction.type === 'INCOME' ? -transaction.amount : transaction.amount;
          await prisma.goal.update({
              where: { id: (transaction as any).goalId },
              data: { currentAmount: { increment: revertGoalAmount } }
          });
      }

      // Revert Debt currentInstallment jika debt bertipe cicilan
      if ((transaction as any).debtId) {
          const debt = await prisma.debt.findUnique({ where: { id: (transaction as any).debtId } });
          if (debt && debt.totalInstallments != null && debt.totalInstallments > 0) {
              const newCurrent = Math.max(0, (debt.currentInstallment ?? 1) - 1);
              await prisma.debt.update({
                  where: { id: (transaction as any).debtId },
                  data: {
                      currentInstallment: newCurrent,
                      status: newCurrent < debt.totalInstallments ? 'UNPAID' : debt.status,
                  },
              });
          }
      }
  
      await prisma.transaction.delete({
        where: { id: Number(id) },
      });
  
      res.json({ message: 'Transaction deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  };

import ExcelJS from 'exceljs';

export const exportTransactions = async (req: AuthRequest, res: Response) => {
    try {
        const transactions = await prisma.transaction.findMany({
            where: { userId: req.user!.id },
            include: { category: true, account: true },
            orderBy: { date: 'desc' },
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Transactions');

        worksheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Description', key: 'description', width: 30 },
            { header: 'Type', key: 'type', width: 10 },
            { header: 'Category', key: 'category', width: 15 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Account', key: 'account', width: 15 },
        ];

        transactions.forEach((t: any) => {
            worksheet.addRow({
                date: t.date.toISOString().split('T')[0],
                description: t.description,
                type: t.type,
                category: t.category.name,
                amount: t.amount,
                account: t.account?.name || '-',
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=transactions.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
