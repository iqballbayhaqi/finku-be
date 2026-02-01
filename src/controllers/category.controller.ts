import { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import prisma from '../utils/prisma';

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

const categorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['INCOME', 'EXPENSE']),
});

export const getCategories = async (req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      where: { userId: req.user!.id },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { name, type } = categorySchema.parse(req.body);

    const category = await prisma.category.create({
      data: {
        name,
        type,
        userId: req.user!.id,
      },
    });

    res.status(201).json(category);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ errors: (error as any).errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type } = categorySchema.parse(req.body);

    const category = await prisma.category.findUnique({
      where: { id: Number(id) },
    });

    if (!category || category.userId !== req.user!.id) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const updatedCategory = await prisma.category.update({
      where: { id: Number(id) },
      data: { name, type },
    });

    res.json(updatedCategory);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ errors: (error as any).errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id: Number(id) },
    });

    if (!category || category.userId !== req.user!.id) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if category is used in transactions
    const transactionsCount = await prisma.transaction.count({
      where: { categoryId: Number(id) },
    });

    if (transactionsCount > 0) {
      return res.status(400).json({ message: 'Cannot delete category with associated transactions' });
    }

    await prisma.category.delete({
      where: { id: Number(id) },
    });

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};
