import { Request, Response } from 'express';
import prisma from '../utils/prisma';

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

export const exportData = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        // Fetch all user-related data
        // Note: We might want to exclude sensitive fields like password if we were dumping the user table,
        // but since we are carefully constructing the object, we can control what's in it.
        // For the 'user' object itself, we should probably exclude the password.
        const user = await prisma.user.findUnique({ 
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                currency: true,
                createdAt: true,
                updatedAt: true,
                // Exclude password
            }
        });

        const accounts = await prisma.account.findMany({ where: { userId } });
        const categories = await prisma.category.findMany({ where: { userId } });
        const transactions = await prisma.transaction.findMany({ where: { userId } });
        const budgets = await prisma.budget.findMany({ where: { userId } });
        const goals = await prisma.goal.findMany({ 
            where: { userId },
            include: { linkedAccounts: true } // Include linkedAccounts for accurate backup
        });
        const debts = await prisma.debt.findMany({ where: { userId } });
        const plannedExpenses = await prisma.plannedExpense.findMany({ where: { userId } });

        const backupData = {
            version: 1,
            timestamp: new Date().toISOString(),
            data: {
                user,
                accounts,
                categories,
                transactions,
                budgets,
                goals,
                debts,
                plannedExpenses
            }
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=finnan_backup_${userId}_${Date.now()}.json`);
        res.json(backupData);

    } catch (error) {
        console.error("Backup error:", error);
        res.status(500).json({ message: 'Failed to create backup' });
    }
};

export const restoreData = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const backup = req.body;

        if (!backup || !backup.data || !backup.version) {
            return res.status(400).json({ message: 'Invalid backup format' });
        }

        const { accounts, categories, transactions, budgets, goals, debts, plannedExpenses } = backup.data;

        await prisma.$transaction(async (tx: any) => {
            // 1. Delete all existing data for the user
            // Delete in reverse order of dependencies
            await tx.transaction.deleteMany({ where: { userId } });
            await tx.budget.deleteMany({ where: { userId } });
            await tx.goal.deleteMany({ where: { userId } });
            await tx.debt.deleteMany({ where: { userId } });
            // Goals might be linked to accounts, but since we delete goals first, it should be fine.
            // Wait, goalId is on Account now? No, Account has goalId (linkedGoal). 
            // If we delete Goals, we might violate FK if Account.goalId exists?
            // SQLite might set null or cascade? 
            // Safest: Set Account.goalId to null first?
            // Actually, if we delete Account later, it's fine.
            // But if Account refers to Goal (linkedGoal), deleting Goal first might fail if RESTRICT.
            // Let's check schema. `linkedGoal Goal?` usually defaults to SET NULL if optional, or RESTRICT.
            // If RESTRICT, we must update accounts to remove goalId first.
            
            // Fix: Update all accounts to remove goal linkage before deleting goals
            await tx.account.updateMany({ 
                where: { userId },
                data: { goalId: null }
            });

            await tx.goal.deleteMany({ where: { userId } });
            await tx.account.deleteMany({ where: { userId } });
            
            // Delete planned expenses before categories (foreign key constraint)
            await tx.plannedExpense.deleteMany({ where: { userId } });
            
            await tx.category.deleteMany({ where: { userId } });

            // 2. Restore data
            // Insert in order of dependencies (Categories -> Accounts -> Goals -> Others)
            
            // Categories
            if (categories && categories.length > 0) {
                 await tx.category.createMany({
                    data: categories.map((c: any) => ({
                        id: c.id,
                        name: c.name,
                        type: c.type,
                        userId: userId,
                        createdAt: new Date(c.createdAt),
                    }))
                });
            }

            // Accounts (without goalId first)
            if (accounts && accounts.length > 0) {
                for (const acc of accounts) {
                     await tx.account.create({
                        data: {
                            id: acc.id,
                            name: acc.name,
                            type: acc.type,
                            balance: Number(acc.balance),
                            stockSymbol: acc.stockSymbol,
                            quantity: acc.quantity ? Number(acc.quantity) : null,
                            imageUrl: acc.imageUrl,
                            userId: userId,
                            createdAt: new Date(acc.createdAt),
                            updatedAt: new Date(acc.updatedAt),
                            // We will link goals later
                        }
                    });
                }
            }

            // Goals (termasuk accountId = source account untuk goal)
            if (goals && goals.length > 0) {
                for (const g of goals) {
                    await tx.goal.create({
                        data: {
                            id: g.id,
                            name: g.name,
                            targetAmount: Number(g.targetAmount),
                            currentAmount: Number(g.currentAmount),
                            imageUrl: g.imageUrl,
                            deadline: g.deadline ? new Date(g.deadline) : null,
                            status: g.status,
                            userId: userId,
                            accountId: g.accountId ? Number(g.accountId) : null,
                        }
                    });
                }
            }

            // Re-link Accounts to Goals (Bibit pockets)
            if (accounts && accounts.length > 0) {
                for (const acc of accounts) {
                    if (acc.goalId) {
                         await tx.account.update({
                            where: { id: acc.id },
                            data: { goalId: acc.goalId }
                         });
                    }
                }
            }
            
            // Debts
             if (debts && debts.length > 0) {
                await tx.debt.createMany({
                    data: debts.map((d: any) => ({
                        id: d.id,
                        personName: d.personName,
                        amount: Number(d.amount),
                        dueDate: d.dueDate ? new Date(d.dueDate) : null,
                        type: d.type,
                        status: d.status,
                        description: d.description,
                        totalInstallments: d.totalInstallments,
                        currentInstallment: d.currentInstallment,
                        userId: userId,
                        createdAt: new Date(d.createdAt),
                        updatedAt: new Date(d.updatedAt)
                    }))
                });
            }

            // Budgets (after Categories)
            if (budgets && budgets.length > 0) {
                await tx.budget.createMany({
                    data: budgets.map((b: any) => ({
                        id: b.id,
                        amount: Number(b.amount),
                        month: b.month,
                        year: b.year,
                        categoryId: b.categoryId,
                        userId: userId,
                        createdAt: new Date(b.createdAt),
                        updatedAt: new Date(b.updatedAt)
                    }))
                });
            }

            // Transactions (after Categories, Accounts, Goals, Debts) - termasuk targetAccountId untuk transfer
            if (transactions && transactions.length > 0) {
                 await tx.transaction.createMany({
                    data: transactions.map((t: any) => ({
                        id: t.id,
                        amount: Number(t.amount),
                        date: new Date(t.date),
                        description: t.description,
                        type: t.type,
                        categoryId: t.categoryId,
                        accountId: t.accountId ? Number(t.accountId) : null,
                        goalId: t.goalId ? Number(t.goalId) : null,
                        debtId: t.debtId ? Number(t.debtId) : null,
                        targetAccountId: t.targetAccountId ? Number(t.targetAccountId) : null,
                        userId: userId,
                        createdAt: new Date(t.createdAt),
                        updatedAt: new Date(t.updatedAt)
                    }))
                });
            }
            
            // Planned Expenses (after Categories, Accounts, and Transactions)
            if (plannedExpenses && plannedExpenses.length > 0) {
                await tx.plannedExpense.createMany({
                    data: plannedExpenses.map((pe: any) => ({
                        id: pe.id,
                        amount: Number(pe.amount),
                        date: new Date(pe.date),
                        description: pe.description,
                        status: pe.status,
                        categoryId: pe.categoryId,
                        accountId: pe.accountId ? Number(pe.accountId) : null,
                        userId: userId,
                        transactionId: pe.transactionId ? Number(pe.transactionId) : null,
                        createdAt: new Date(pe.createdAt),
                        updatedAt: new Date(pe.updatedAt)
                    }))
                });
            }
        });

        res.json({ message: 'Data restored successfully' });
    } catch (error) {
        console.error("Restore error:", error);
        res.status(500).json({ message: 'Failed to restore data' });
    }
};
