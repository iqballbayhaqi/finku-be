import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z, ZodError } from 'zod';
import prisma from '../utils/prisma';

// Validation Schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  currency: z.enum(['IDR', 'USD']).default('IDR'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, currency } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        currency,
        // Create default Account (Wallet)
        accounts: {
          create: {
            name: 'Wallet',
            type: 'CASH',
            balance: 0,
          },
        },
        // Create default Categories
        categories: {
          create: [
            { name: 'Salary', type: 'INCOME' },
            { name: 'Food', type: 'EXPENSE' },
            { name: 'Transport', type: 'EXPENSE' },
            { name: 'Utilities', type: 'EXPENSE' },
            { name: 'Entertainment', type: 'EXPENSE' },
          ],
        },
      },
    });

    res.status(201).json({ message: 'User created successfully', userId: user.id });
  } catch (error) {

    if (error instanceof ZodError) {
      return res.status(400).json({ errors: (error as any).errors });
    }
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      { expiresIn: '1d' }
    );

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, currency: user.currency } });
  } catch (error) {

    if (error instanceof ZodError) {
      return res.status(400).json({ errors: (error as any).errors });
    }
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getMe = async (req: Request | any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, currency: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};
