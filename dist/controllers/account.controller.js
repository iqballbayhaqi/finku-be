"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAccount = exports.updateAccount = exports.createAccount = exports.getAccounts = void 0;
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../utils/prisma"));
const accountSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    type: zod_1.z.enum(['BANK', 'E_WALLET', 'CASH', 'OTHER', 'REKSADANA', 'SAHAM', 'CRYPTO']),
    balance: zod_1.z.number().default(0),
    stockSymbol: zod_1.z.string().optional(),
    quantity: zod_1.z.number().optional().nullable(),
    imageUrl: zod_1.z.string().optional().nullable(),
    goalId: zod_1.z.number().optional().nullable(),
});
const getAccounts = async (req, res) => {
    try {
        const accounts = await prisma_1.default.account.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
        });
        res.json(accounts);
    }
    catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.getAccounts = getAccounts;
const createAccount = async (req, res) => {
    try {
        const { name, type, balance, stockSymbol, quantity, imageUrl, goalId } = accountSchema.parse(req.body);
        const account = await prisma_1.default.account.create({
            data: {
                name,
                type,
                balance,
                stockSymbol,
                quantity,
                imageUrl,
                goalId: goalId ? Number(goalId) : null,
                userId: req.user.id,
            },
        });
        res.status(201).json(account);
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json({ errors: error.errors });
        }
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.createAccount = createAccount;
const updateAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, balance, stockSymbol, quantity, imageUrl, goalId } = accountSchema.parse(req.body);
        const account = await prisma_1.default.account.findUnique({
            where: { id: Number(id) },
        });
        if (!account || account.userId !== req.user.id) {
            return res.status(404).json({ message: 'Account not found' });
        }
        const updatedAccount = await prisma_1.default.account.update({
            where: { id: Number(id) },
            data: { name, type, balance, stockSymbol, quantity, imageUrl, goalId: goalId ? Number(goalId) : null },
        });
        res.json(updatedAccount);
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json({ errors: error.errors });
        }
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.updateAccount = updateAccount;
const deleteAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const account = await prisma_1.default.account.findUnique({
            where: { id: Number(id) },
        });
        if (!account || account.userId !== req.user.id) {
            return res.status(404).json({ message: 'Account not found' });
        }
        // Check if account has transactions
        const transactionCount = await prisma_1.default.transaction.count({
            where: { accountId: Number(id) }
        });
        if (transactionCount > 0) {
            return res.status(400).json({ message: 'Cannot delete account with associated transactions' });
        }
        await prisma_1.default.account.delete({
            where: { id: Number(id) },
        });
        res.json({ message: 'Account deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.deleteAccount = deleteAccount;
