"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportTransactions = exports.deleteTransaction = exports.createTransaction = exports.getTransactions = void 0;
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../utils/prisma"));
const transactionSchema = zod_1.z.object({
    amount: zod_1.z.coerce.number().positive(),
    date: zod_1.z.string(), // ISO String
    description: zod_1.z.string().optional(),
    type: zod_1.z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
    categoryId: zod_1.z.coerce.number(),
    accountId: zod_1.z.union([zod_1.z.null(), zod_1.z.coerce.number()]).optional(),
    targetAccountId: zod_1.z.union([zod_1.z.null(), zod_1.z.coerce.number()]).optional(),
    goalId: zod_1.z.union([zod_1.z.null(), zod_1.z.coerce.number()]).optional(),
    debtId: zod_1.z.union([zod_1.z.null(), zod_1.z.coerce.number()]).optional(),
});
const getTransactions = async (req, res) => {
    try {
        const { startDate, endDate, type, categoryId } = req.query;
        const whereClause = {
            userId: req.user.id,
        };
        if (startDate && endDate) {
            whereClause.date = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }
        if (type) {
            whereClause.type = type;
        }
        if (categoryId) {
            whereClause.categoryId = Number(categoryId);
        }
        const transactions = await prisma_1.default.transaction.findMany({
            where: whereClause,
            include: { category: true, account: true, targetAccount: true, debt: true },
            orderBy: { date: 'desc' },
        });
        res.json(transactions);
    }
    catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.getTransactions = getTransactions;
const createTransaction = async (req, res) => {
    try {
        const { amount, date, description, type, categoryId, accountId, targetAccountId, goalId, debtId } = transactionSchema.parse(req.body);
        // Verify category ownership
        const category = await prisma_1.default.category.findUnique({ where: { id: categoryId } });
        if (!category || category.userId !== req.user.id) {
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
            const sourceAccount = await prisma_1.default.account.findUnique({ where: { id: accountId } });
            const targetAccount = await prisma_1.default.account.findUnique({ where: { id: targetAccountId } });
            if (!sourceAccount || sourceAccount.userId !== req.user.id || !targetAccount || targetAccount.userId !== req.user.id) {
                return res.status(400).json({ message: 'Invalid source or target account' });
            }
            // Atomic Transaction for Transfer
            const result = await prisma_1.default.$transaction(async (tx) => {
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
                        userId: req.user.id,
                    },
                    include: { category: true, account: true, targetAccount: true }
                });
            });
            return res.status(201).json(result);
        }
        // Handle Balance Update if Account is linked (Normal Income/Expense)
        if (accountId) {
            const account = await prisma_1.default.account.findUnique({ where: { id: accountId } });
            if (!account || account.userId !== req.user.id) {
                return res.status(400).json({ message: 'Invalid account' });
            }
            // Update balance
            const balanceChange = type === 'INCOME' ? amount : -amount;
            await prisma_1.default.account.update({
                where: { id: accountId },
                data: { balance: { increment: balanceChange } }
            });
        }
        // Handle Goal Update if Goal is linked
        if (goalId) {
            const goal = await prisma_1.default.goal.findUnique({ where: { id: goalId } });
            if (!goal || goal.userId !== req.user.id) {
                return res.status(400).json({ message: 'Invalid goal' });
            }
            // Logic: INCOME (Saving) adds to currentAmount, EXPENSE (Withdrawal) subtracts
            // Usually linking goal implies saving, so INCOME is typical.
            const amountChange = type === 'INCOME' ? amount : -amount;
            await prisma_1.default.goal.update({
                where: { id: goalId },
                data: { currentAmount: { increment: amountChange } }
            });
        }
        // Handle Debt Link if linked
        if (debtId) {
            const debt = await prisma_1.default.debt.findUnique({ where: { id: debtId } });
            if (!debt || debt.userId !== req.user.id) {
                return res.status(400).json({ message: 'Invalid debt' });
            }
            // Jika debt bertipe cicilan (punya totalInstallments), naikkan currentInstallment +1
            if (debt.totalInstallments != null && debt.totalInstallments > 0) {
                const newCurrent = (debt.currentInstallment ?? 0) + 1;
                await prisma_1.default.debt.update({
                    where: { id: debtId },
                    data: {
                        currentInstallment: newCurrent,
                        // Auto-mark PAID jika sudah mencapai cicilan terakhir
                        ...(newCurrent >= debt.totalInstallments ? { status: 'PAID' } : {}),
                    },
                });
            }
        }
        const transaction = await prisma_1.default.transaction.create({
            data: {
                amount,
                date: new Date(date),
                description,
                type,
                categoryId,
                accountId,
                goalId,
                debtId,
                userId: req.user.id,
            },
            include: { category: true },
        });
        res.status(201).json(transaction);
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json({ errors: error.errors });
        }
        // console.log(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.createTransaction = createTransaction;
const deleteTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const transaction = await prisma_1.default.transaction.findUnique({
            where: { id: Number(id) },
        });
        if (!transaction || transaction.userId !== req.user.id) {
            return res.status(404).json({ message: 'Transaction not found' });
        }
        // Revert Transfer
        if (transaction.type === 'TRANSFER' && transaction.targetAccountId && transaction.accountId) {
            await prisma_1.default.$transaction(async (tx) => {
                // Revert Source (Add back)
                await tx.account.update({
                    where: { id: transaction.accountId },
                    data: { balance: { increment: transaction.amount } }
                });
                // Revert Target (Deduct)
                await tx.account.update({
                    where: { id: transaction.targetAccountId },
                    data: { balance: { decrement: transaction.amount } }
                });
                // Delete Transaction
                await tx.transaction.delete({ where: { id: Number(id) } });
            });
            return res.json({ message: 'Transfer deleted successfully' });
        }
        // Revert Balance if account linked (Income/Expense)
        if (transaction.accountId) {
            const revertAmount = transaction.type === 'INCOME' ? -transaction.amount : transaction.amount;
            await prisma_1.default.account.update({
                where: { id: transaction.accountId },
                data: { balance: { increment: revertAmount } }
            });
        }
        // Revert Goal Balance if goal linked
        if (transaction.goalId) {
            const revertGoalAmount = transaction.type === 'INCOME' ? -transaction.amount : transaction.amount;
            await prisma_1.default.goal.update({
                where: { id: transaction.goalId },
                data: { currentAmount: { increment: revertGoalAmount } }
            });
        }
        // Revert Debt currentInstallment jika debt bertipe cicilan
        if (transaction.debtId) {
            const debt = await prisma_1.default.debt.findUnique({ where: { id: transaction.debtId } });
            if (debt && debt.totalInstallments != null && debt.totalInstallments > 0) {
                const newCurrent = Math.max(0, (debt.currentInstallment ?? 1) - 1);
                await prisma_1.default.debt.update({
                    where: { id: transaction.debtId },
                    data: {
                        currentInstallment: newCurrent,
                        status: newCurrent < debt.totalInstallments ? 'UNPAID' : debt.status,
                    },
                });
            }
        }
        await prisma_1.default.transaction.delete({
            where: { id: Number(id) },
        });
        res.json({ message: 'Transaction deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.deleteTransaction = deleteTransaction;
const exceljs_1 = __importDefault(require("exceljs"));
const exportTransactions = async (req, res) => {
    try {
        const transactions = await prisma_1.default.transaction.findMany({
            where: { userId: req.user.id },
            include: { category: true, account: true },
            orderBy: { date: 'desc' },
        });
        const workbook = new exceljs_1.default.Workbook();
        const worksheet = workbook.addWorksheet('Transactions');
        worksheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Description', key: 'description', width: 30 },
            { header: 'Type', key: 'type', width: 10 },
            { header: 'Category', key: 'category', width: 15 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Account', key: 'account', width: 15 },
        ];
        transactions.forEach((t) => {
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
    }
    catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.exportTransactions = exportTransactions;
