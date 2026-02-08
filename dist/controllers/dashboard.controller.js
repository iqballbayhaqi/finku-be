"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStats = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id;
        // 1. Calculate Net Worth
        const accounts = await prisma_1.default.account.findMany({ where: { userId } });
        const totalCash = accounts.reduce((sum, acc) => sum + acc.balance, 0);
        const debts = await prisma_1.default.debt.findMany({ where: { userId, status: 'UNPAID' } });
        const payables = debts.filter((d) => d.type === 'PAYABLE').reduce((sum, d) => sum + d.amount, 0);
        const receivables = debts.filter((d) => d.type === 'RECEIVABLE').reduce((sum, d) => sum + d.amount, 0);
        const netWorth = totalCash + receivables - payables;
        // 2. Determine Wealth Level & Amount Needed for Next Level
        const WEALTH_THRESHOLDS = [
            { level: 'KEKURANGAN', min: -Infinity, next: 'BERTAHAN', nextMin: 0 },
            { level: 'BERTAHAN', min: 0, next: 'AMAN', nextMin: 10000000 },
            { level: 'AMAN', min: 10000000, next: 'NYAMAN', nextMin: 100000000 },
            { level: 'NYAMAN', min: 100000000, next: 'SULTAN', nextMin: 1000000000 },
            { level: 'SULTAN', min: 1000000000, next: null, nextMin: null },
        ];
        let wealthLevel = 'KEKURANGAN';
        let amountToNextLevel = null;
        let nextLevel = null;
        for (let i = WEALTH_THRESHOLDS.length - 1; i >= 0; i--) {
            const t = WEALTH_THRESHOLDS[i];
            if (netWorth >= t.min) {
                wealthLevel = t.level;
                if (t.nextMin !== null) {
                    amountToNextLevel = Math.max(0, t.nextMin - netWorth);
                    nextLevel = t.next;
                }
                break;
            }
        }
        // 3. Financial Health Score (Simplified Logic)
        let healthScore = 50;
        if (netWorth > 0)
            healthScore += 10;
        if (payables === 0)
            healthScore += 10;
        if (receivables > 0)
            healthScore += 5;
        if (totalCash > payables)
            healthScore += 15;
        if (healthScore > 100)
            healthScore = 100;
        // 4. Recent Transactions
        const recentTransactions = await prisma_1.default.transaction.findMany({
            where: { userId },
            take: 5,
            orderBy: { date: 'desc' },
            include: { category: true }
        });
        // 5. Expense Composition (by Category)
        const expenseByCategory = await prisma_1.default.transaction.groupBy({
            by: ['categoryId'],
            where: { userId, type: 'EXPENSE' },
            _sum: { amount: true },
        });
        // Enrich with category names (Prisma groupBy doesn't support include)
        const categoryIds = expenseByCategory.map((e) => e.categoryId);
        const categories = await prisma_1.default.category.findMany({ where: { id: { in: categoryIds } } });
        const expenseChartData = expenseByCategory.map((e) => {
            const cat = categories.find((c) => c.id === e.categoryId);
            return {
                name: cat?.name || 'Unknown',
                value: e._sum.amount || 0
            };
        });
        // 6. Account Composition (Balance by Account)
        const accountChartData = accounts
            .filter((acc) => acc.balance > 0)
            .map((acc) => ({
            name: acc.name,
            value: acc.balance
        }));
        // 7. Total Cash Trend (day by day) - last 60 days
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        sixtyDaysAgo.setHours(0, 0, 0, 0);
        const transactionsForTrend = await prisma_1.default.transaction.findMany({
            where: { userId, date: { gte: sixtyDaysAgo } },
            select: { date: true, type: true, amount: true },
            orderBy: { date: 'asc' }
        });
        const dailyNet = {};
        transactionsForTrend.forEach((t) => {
            const dateStr = t.date.toISOString().split('T')[0];
            if (!dailyNet[dateStr])
                dailyNet[dateStr] = 0;
            if (t.type === 'INCOME')
                dailyNet[dateStr] += t.amount;
            else if (t.type === 'EXPENSE')
                dailyNet[dateStr] -= t.amount;
        });
        const totalChange = Object.values(dailyNet).reduce((a, b) => a + b, 0);
        const startBalance = totalCash - totalChange;
        const sortedDates = Object.keys(dailyNet).sort();
        let runningTotal = startBalance;
        const totalCashHistory = sortedDates.map(date => {
            runningTotal += dailyNet[date];
            return { date, totalCash: Math.round(runningTotal * 100) / 100 };
        });
        const todayStr = new Date().toISOString().split('T')[0];
        if (totalCashHistory.length === 0 || totalCashHistory[totalCashHistory.length - 1].date !== todayStr) {
            totalCashHistory.push({ date: todayStr, totalCash });
        }
        res.json({
            netWorth,
            totalCash,
            receivables,
            payables,
            wealthLevel,
            healthScore,
            amountToNextLevel,
            nextLevel,
            recentTransactions,
            expenseChartData,
            accountChartData,
            totalCashHistory
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.getDashboardStats = getDashboardStats;
