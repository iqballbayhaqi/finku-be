"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBudget = exports.createBudget = exports.getBudgets = void 0;
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../utils/prisma"));
const budgetSchema = zod_1.z.object({
    amount: zod_1.z.coerce.number().positive(),
    month: zod_1.z.coerce.number().min(1).max(12),
    year: zod_1.z.coerce.number().min(2020),
    categoryId: zod_1.z.coerce.number(),
});
const getBudgets = async (req, res) => {
    try {
        const { month, year } = req.query;
        const whereClause = { userId: req.user.id };
        if (month)
            whereClause.month = Number(month);
        if (year)
            whereClause.year = Number(year);
        const budgets = await prisma_1.default.budget.findMany({
            where: whereClause,
            include: { category: true },
        });
        // Calculate progress for each budget
        const budgetsWithProgress = await Promise.all(budgets.map(async (budget) => {
            // Find start and end date of the month
            const startDate = new Date(budget.year, budget.month - 1, 1);
            const endDate = new Date(budget.year, budget.month, 1); // First day of NEXT month
            const expenses = await prisma_1.default.transaction.aggregate({
                _sum: { amount: true },
                where: {
                    userId: req.user.id,
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
    }
    catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.getBudgets = getBudgets;
const createBudget = async (req, res) => {
    try {
        const { amount, month, year, categoryId } = budgetSchema.parse(req.body);
        // Check if budget already exists for this category/month/year
        const existingBudget = await prisma_1.default.budget.findFirst({
            where: {
                userId: req.user.id,
                categoryId,
                month,
                year
            }
        });
        if (existingBudget) {
            return res.status(400).json({ message: 'Budget already exists for this category in this period' });
        }
        const budget = await prisma_1.default.budget.create({
            data: {
                amount,
                month,
                year,
                categoryId,
                userId: req.user.id,
            },
            include: { category: true },
        });
        res.status(201).json(budget);
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json({ errors: error.errors });
        }
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.createBudget = createBudget;
const deleteBudget = async (req, res) => {
    try {
        const { id } = req.params;
        const budget = await prisma_1.default.budget.findUnique({
            where: { id: Number(id) },
        });
        if (!budget || budget.userId !== req.user.id) {
            return res.status(404).json({ message: 'Budget not found' });
        }
        await prisma_1.default.budget.delete({
            where: { id: Number(id) },
        });
        res.json({ message: 'Budget deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.deleteBudget = deleteBudget;
