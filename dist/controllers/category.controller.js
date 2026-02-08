"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategories = void 0;
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../utils/prisma"));
const categorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    type: zod_1.z.enum(['INCOME', 'EXPENSE']),
});
const getCategories = async (req, res) => {
    try {
        const categories = await prisma_1.default.category.findMany({
            where: { userId: req.user.id },
            orderBy: { name: 'asc' },
        });
        res.json(categories);
    }
    catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.getCategories = getCategories;
const createCategory = async (req, res) => {
    try {
        const { name, type } = categorySchema.parse(req.body);
        const category = await prisma_1.default.category.create({
            data: {
                name,
                type,
                userId: req.user.id,
            },
        });
        res.status(201).json(category);
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json({ errors: error.errors });
        }
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.createCategory = createCategory;
const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type } = categorySchema.parse(req.body);
        const category = await prisma_1.default.category.findUnique({
            where: { id: Number(id) },
        });
        if (!category || category.userId !== req.user.id) {
            return res.status(404).json({ message: 'Category not found' });
        }
        const updatedCategory = await prisma_1.default.category.update({
            where: { id: Number(id) },
            data: { name, type },
        });
        res.json(updatedCategory);
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json({ errors: error.errors });
        }
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.updateCategory = updateCategory;
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await prisma_1.default.category.findUnique({
            where: { id: Number(id) },
        });
        if (!category || category.userId !== req.user.id) {
            return res.status(404).json({ message: 'Category not found' });
        }
        // Check if category is used in transactions
        const transactionsCount = await prisma_1.default.transaction.count({
            where: { categoryId: Number(id) },
        });
        if (transactionsCount > 0) {
            return res.status(400).json({ message: 'Cannot delete category with associated transactions' });
        }
        await prisma_1.default.category.delete({
            where: { id: Number(id) },
        });
        res.json({ message: 'Category deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.deleteCategory = deleteCategory;
