"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeToTransaction = exports.deletePlannedExpense = exports.updatePlannedExpense = exports.createPlannedExpense = exports.getPlannedExpenses = void 0;
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../utils/prisma"));
const plannedExpenseSchema = zod_1.z.object({
    amount: zod_1.z.coerce.number().positive(),
    date: zod_1.z.string().datetime(),
    description: zod_1.z.union([zod_1.z.string(), zod_1.z.null()]).optional(),
    categoryId: zod_1.z.coerce.number(),
    accountId: zod_1.z.union([zod_1.z.null(), zod_1.z.coerce.number()]).optional(),
});
const updatePlannedExpenseSchema = zod_1.z.object({
    amount: zod_1.z.coerce.number().positive().optional(),
    date: zod_1.z.union([zod_1.z.string().datetime(), zod_1.z.string()]).optional(),
    description: zod_1.z.union([zod_1.z.string(), zod_1.z.null()]).optional(),
    categoryId: zod_1.z.coerce.number().optional(),
    accountId: zod_1.z.union([zod_1.z.null(), zod_1.z.coerce.number()]).optional(),
    status: zod_1.z.enum(['PLANNED', 'EXECUTED', 'CANCELLED']).optional(),
});
const getPlannedExpenses = async (req, res) => {
    try {
        const { month, year, status } = req.query;
        const whereClause = { userId: req.user.id };
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
        const plannedExpenses = await prisma_1.default.plannedExpense.findMany({
            where: whereClause,
            include: {
                category: true,
                account: true,
                transaction: true
            },
            orderBy: { date: 'asc' }
        });
        res.json(plannedExpenses);
    }
    catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.getPlannedExpenses = getPlannedExpenses;
const createPlannedExpense = async (req, res) => {
    try {
        const { amount, date, description, categoryId, accountId } = plannedExpenseSchema.parse(req.body);
        const plannedExpense = await prisma_1.default.plannedExpense.create({
            data: {
                amount,
                date: new Date(date),
                description,
                categoryId,
                accountId,
                userId: req.user.id,
            },
            include: {
                category: true,
                account: true
            },
        });
        res.status(201).json(plannedExpense);
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json({ errors: error.errors });
        }
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.createPlannedExpense = createPlannedExpense;
const updatePlannedExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const data = updatePlannedExpenseSchema.parse(req.body);
        const plannedExpense = await prisma_1.default.plannedExpense.findUnique({
            where: { id: Number(id) },
        });
        if (!plannedExpense || plannedExpense.userId !== req.user.id) {
            return res.status(404).json({ message: 'Planned expense not found' });
        }
        // Build update data - only include defined fields, convert date
        const updateData = {};
        if (data.amount !== undefined)
            updateData.amount = data.amount;
        if (data.date !== undefined) {
            const parsedDate = new Date(data.date);
            if (isNaN(parsedDate.getTime())) {
                return res.status(400).json({ message: 'Invalid date format' });
            }
            updateData.date = parsedDate;
        }
        if (data.description !== undefined)
            updateData.description = data.description;
        if (data.categoryId !== undefined) {
            const category = await prisma_1.default.category.findUnique({ where: { id: data.categoryId } });
            if (!category || category.userId !== req.user.id) {
                return res.status(400).json({ message: 'Invalid category' });
            }
            updateData.category = { connect: { id: data.categoryId } };
        }
        if (data.accountId !== undefined) {
            if (data.accountId === null) {
                updateData.account = { disconnect: true };
            }
            else {
                const account = await prisma_1.default.account.findUnique({ where: { id: data.accountId } });
                if (!account || account.userId !== req.user.id) {
                    return res.status(400).json({ message: 'Invalid account' });
                }
                updateData.account = { connect: { id: data.accountId } };
            }
        }
        if (data.status !== undefined)
            updateData.status = data.status;
        const updated = await prisma_1.default.plannedExpense.update({
            where: { id: Number(id) },
            data: updateData,
            include: {
                category: true,
                account: true
            },
        });
        res.json(updated);
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json({ errors: error.errors });
        }
        if (error?.code === 'P2003') {
            return res.status(400).json({ message: 'Invalid category or account reference' });
        }
        console.error('Update planned expense error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.updatePlannedExpense = updatePlannedExpense;
const deletePlannedExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const plannedExpense = await prisma_1.default.plannedExpense.findUnique({
            where: { id: Number(id) },
        });
        if (!plannedExpense || plannedExpense.userId !== req.user.id) {
            return res.status(404).json({ message: 'Planned expense not found' });
        }
        await prisma_1.default.plannedExpense.delete({
            where: { id: Number(id) },
        });
        res.json({ message: 'Planned expense deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.deletePlannedExpense = deletePlannedExpense;
const executeToTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const plannedExpense = await prisma_1.default.plannedExpense.findUnique({
            where: { id: Number(id) },
        });
        if (!plannedExpense || plannedExpense.userId !== req.user.id) {
            return res.status(404).json({ message: 'Planned expense not found' });
        }
        if (plannedExpense.status === 'EXECUTED') {
            return res.status(400).json({ message: 'Planned expense already executed' });
        }
        // Hanya mengubah status - tidak membuat transaction atau mengubah data lain
        const updatedPlannedExpense = await prisma_1.default.plannedExpense.update({
            where: { id: Number(id) },
            data: { status: 'EXECUTED' },
            include: {
                category: true,
                account: true,
            },
        });
        res.json(updatedPlannedExpense);
    }
    catch (error) {
        console.error('Execute error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.executeToTransaction = executeToTransaction;
