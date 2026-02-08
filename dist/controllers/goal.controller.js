"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteGoal = exports.updateGoal = exports.createGoal = exports.getGoals = void 0;
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../utils/prisma"));
const goalSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    targetAmount: zod_1.z.number().positive(),
    currentAmount: zod_1.z.number().min(0).default(0),
    imageUrl: zod_1.z.string().optional(),
    deadline: zod_1.z.union([zod_1.z.string(), zod_1.z.null()]).optional(), // ISO Date string or null
    status: zod_1.z.enum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('IN_PROGRESS'),
    accountId: zod_1.z.coerce.number().optional(),
});
const getGoals = async (req, res) => {
    try {
        const goals = await prisma_1.default.goal.findMany({
            where: { userId: req.user.id },
            include: {
                account: true,
                linkedAccounts: true
            },
            orderBy: { createdAt: 'desc' },
        });
        const goalsWithTotal = goals.map((goal) => {
            let calculatedAmount = goal.currentAmount;
            if (goal.linkedAccounts && goal.linkedAccounts.length > 0) {
                calculatedAmount = goal.linkedAccounts.reduce((sum, acc) => sum + acc.balance, 0);
            }
            else if (goal.accountId && goal.account) {
                calculatedAmount = goal.account.balance;
            }
            return {
                ...goal,
                currentAmount: calculatedAmount
            };
        });
        res.json(goalsWithTotal);
    }
    catch (error) {
        console.error('Error in getGoals:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.getGoals = getGoals;
const createGoal = async (req, res) => {
    try {
        const parsed = goalSchema.parse(req.body);
        let { name, targetAmount, currentAmount, imageUrl, deadline, status, accountId } = parsed;
        if (accountId) {
            const account = await prisma_1.default.account.findFirst({
                where: { id: Number(accountId), userId: req.user.id },
            });
            if (account)
                currentAmount = account.balance;
        }
        const goal = await prisma_1.default.goal.create({
            data: {
                name,
                targetAmount,
                currentAmount,
                imageUrl,
                deadline: deadline ? new Date(deadline) : null,
                status,
                userId: req.user.id,
                accountId: accountId ? Number(accountId) : null,
            },
            include: { account: true },
        });
        res.status(201).json(goal);
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json({ errors: error.errors });
        }
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.createGoal = createGoal;
const updateGoal = async (req, res) => {
    try {
        const { id } = req.params;
        const parsed = goalSchema.parse(req.body);
        let { name, targetAmount, currentAmount, imageUrl, deadline, status, accountId } = parsed;
        const goal = await prisma_1.default.goal.findUnique({
            where: { id: Number(id) },
        });
        if (!goal || goal.userId !== req.user.id) {
            return res.status(404).json({ message: 'Goal not found' });
        }
        if (accountId) {
            const account = await prisma_1.default.account.findFirst({
                where: { id: Number(accountId), userId: req.user.id },
            });
            if (account)
                currentAmount = account.balance;
        }
        const updatedGoal = await prisma_1.default.goal.update({
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
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json({ errors: error.errors });
        }
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.updateGoal = updateGoal;
const deleteGoal = async (req, res) => {
    try {
        const { id } = req.params;
        const goal = await prisma_1.default.goal.findUnique({
            where: { id: Number(id) },
        });
        if (!goal || goal.userId !== req.user.id) {
            return res.status(404).json({ message: 'Goal not found' });
        }
        await prisma_1.default.goal.delete({
            where: { id: Number(id) },
        });
        res.json({ message: 'Goal deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.deleteGoal = deleteGoal;
