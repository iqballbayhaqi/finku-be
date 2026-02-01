import { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import prisma from '../utils/prisma';

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

const debtSchema = z.object({
  personName: z.string().min(1),
  amount: z.number().positive(),
  dueDate: z.string().optional().nullable(), // ISO String
  type: z.enum(['PAYABLE', 'RECEIVABLE']), // PAYABLE = Hutang, RECEIVABLE = Piutang
  status: z.enum(['UNPAID', 'PAID']).default('UNPAID'),
  description: z.string().optional().nullable(),
  totalInstallments: z.number().optional().nullable(),
  currentInstallment: z.number().optional().nullable(),
});

export const getDebts = async (req: AuthRequest, res: Response) => {
  try {
    const debts = await prisma.debt.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(debts);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createDebt = async (req: AuthRequest, res: Response) => {
  try {
    const { personName, amount, dueDate, type, status, description, totalInstallments, currentInstallment } = debtSchema.parse(req.body);
    
    const debt = await prisma.debt.create({
      data: {
        personName,
        amount,
        dueDate: dueDate ? new Date(dueDate) : null,
        type,
        status,
        description,
        totalInstallments,
        currentInstallment,
        userId: req.user!.id,
      },
    });

    res.status(201).json(debt);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ errors: (error as any).errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateDebt = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { personName, amount, dueDate, type, status, description, totalInstallments, currentInstallment } = debtSchema.parse(req.body);
    
    const debt = await prisma.debt.findUnique({
      where: { id: Number(id) },
    });

    if (!debt || debt.userId !== req.user!.id) {
      return res.status(404).json({ message: 'Debt not found' });
    }

    const updatedDebt = await prisma.debt.update({
      where: { id: Number(id) },
      data: {
        personName,
        amount,
        dueDate: dueDate ? new Date(dueDate) : null,
        type,
        status,
        description,
        totalInstallments,
        currentInstallment,
      },
    });

    res.json(updatedDebt);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ errors: (error as any).errors });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteDebt = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const debt = await prisma.debt.findUnique({
      where: { id: Number(id) },
    });

    if (!debt || debt.userId !== req.user!.id) {
      return res.status(404).json({ message: 'Debt not found' });
    }

    await prisma.debt.delete({
      where: { id: Number(id) },
    });

    res.json({ message: 'Debt deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};
import ExcelJS from 'exceljs';
import fs from 'fs';

export const importDebts = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);
        const worksheet = workbook.getWorksheet(1);
        
        if (!worksheet) {
             return res.status(400).json({ message: 'Invalid excel file' });
        }

        const debtsToCreate: any[] = [];
        
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header

            // Assuming columns: Name, Amount, Status, Type
            const personName = row.getCell(1).value?.toString();
            const amount = Number(row.getCell(2).value);
            const status = row.getCell(3).value?.toString()?.toUpperCase() === 'LUNAS' || row.getCell(3).value?.toString()?.toUpperCase() === 'PAID' ? 'PAID' : 'UNPAID';
            const typeRaw = row.getCell(4).value?.toString()?.toUpperCase();
            // Default to PAYABLE if not specified or invalid. Support 'RECEIVABLE' or 'PIUTANG'
            const type = (typeRaw === 'RECEIVABLE' || typeRaw === 'PIUTANG') ? 'RECEIVABLE' : 'PAYABLE';
            
            if (personName && amount) {
                debtsToCreate.push({
                    personName,
                    amount,
                    type: type, 
                    status: status,
                    userId: req.user!.id,
                    totalInstallments: null,
                    currentInstallment: null
                });
            }
        });

        if (debtsToCreate.length > 0) {
            await prisma.debt.createMany({
                data: debtsToCreate
            });
        }

        // Clean up file
        fs.unlinkSync(req.file.path);

        res.json({ message: `Successfully imported ${debtsToCreate.length} records` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getDebtTemplate = async (req: AuthRequest, res: Response) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Debt Template');

        worksheet.columns = [
            { header: 'Person Name', key: 'name', width: 20 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Status (UNPAID/PAID)', key: 'status', width: 15 },
            { header: 'Type (PAYABLE/RECEIVABLE)', key: 'type', width: 20 },
        ];

        // Add Example Row
        worksheet.addRow({
            name: 'Contoh Hutang',
            amount: 100000,
            status: 'UNPAID',
            type: 'PAYABLE'
        });
        worksheet.addRow({
            name: 'Contoh Piutang',
            amount: 50000,
            status: 'UNPAID',
            type: 'RECEIVABLE'
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=debt_template.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const exportDebts = async (req: AuthRequest, res: Response) => {
    try {
        const debts = await prisma.debt.findMany({
            where: { userId: req.user!.id },
            orderBy: { createdAt: 'desc' },
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Debts');

        worksheet.columns = [
            { header: 'Person Name', key: 'personName', width: 20 },
            { header: 'Type', key: 'type', width: 10 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Status', key: 'status', width: 10 },
            { header: 'Due Date', key: 'dueDate', width: 15 },
            { header: 'Description', key: 'description', width: 25 },
            { header: 'Installments', key: 'installments', width: 15 },
        ];

        debts.forEach((d: any) => {
            worksheet.addRow({
                personName: d.personName,
                type: d.type,
                amount: d.amount,
                status: d.status,
                dueDate: d.dueDate ? d.dueDate.toISOString().split('T')[0] : '',
                description: d.description,
                installments: d.totalInstallments ? `${d.currentInstallment || 0}/${d.totalInstallments}` : '-',
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=debts.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
