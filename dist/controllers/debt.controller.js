"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportDebts = exports.getDebtTemplate = exports.importDebts = exports.deleteDebt = exports.updateDebt = exports.createDebt = exports.getDebts = void 0;
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../utils/prisma"));
const debtSchema = zod_1.z.object({
    personName: zod_1.z.string().min(1),
    amount: zod_1.z.number().positive(),
    dueDate: zod_1.z.string().optional().nullable(), // ISO String
    type: zod_1.z.enum(['PAYABLE', 'RECEIVABLE']), // PAYABLE = Hutang, RECEIVABLE = Piutang
    status: zod_1.z.enum(['UNPAID', 'PAID']).default('UNPAID'),
    description: zod_1.z.string().optional().nullable(),
    totalInstallments: zod_1.z.number().optional().nullable(),
    currentInstallment: zod_1.z.number().optional().nullable(),
});
const getDebts = async (req, res) => {
    try {
        const debts = await prisma_1.default.debt.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
        });
        res.json(debts);
    }
    catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.getDebts = getDebts;
const createDebt = async (req, res) => {
    try {
        const { personName, amount, dueDate, type, status, description, totalInstallments, currentInstallment } = debtSchema.parse(req.body);
        const debt = await prisma_1.default.debt.create({
            data: {
                personName,
                amount,
                dueDate: dueDate ? new Date(dueDate) : null,
                type,
                status,
                description,
                totalInstallments,
                currentInstallment,
                userId: req.user.id,
            },
        });
        res.status(201).json(debt);
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json({ errors: error.errors });
        }
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.createDebt = createDebt;
const updateDebt = async (req, res) => {
    try {
        const { id } = req.params;
        const { personName, amount, dueDate, type, status, description, totalInstallments, currentInstallment } = debtSchema.parse(req.body);
        const debt = await prisma_1.default.debt.findUnique({
            where: { id: Number(id) },
        });
        if (!debt || debt.userId !== req.user.id) {
            return res.status(404).json({ message: 'Debt not found' });
        }
        const updatedDebt = await prisma_1.default.debt.update({
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
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json({ errors: error.errors });
        }
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.updateDebt = updateDebt;
const deleteDebt = async (req, res) => {
    try {
        const { id } = req.params;
        const debt = await prisma_1.default.debt.findUnique({
            where: { id: Number(id) },
        });
        if (!debt || debt.userId !== req.user.id) {
            return res.status(404).json({ message: 'Debt not found' });
        }
        await prisma_1.default.debt.delete({
            where: { id: Number(id) },
        });
        res.json({ message: 'Debt deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.deleteDebt = deleteDebt;
const exceljs_1 = __importDefault(require("exceljs"));
const fs_1 = __importDefault(require("fs"));
const importDebts = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        const workbook = new exceljs_1.default.Workbook();
        await workbook.xlsx.readFile(req.file.path);
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) {
            return res.status(400).json({ message: 'Invalid excel file' });
        }
        const debtsToCreate = [];
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1)
                return; // Skip header
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
                    userId: req.user.id,
                    totalInstallments: null,
                    currentInstallment: null
                });
            }
        });
        if (debtsToCreate.length > 0) {
            await prisma_1.default.debt.createMany({
                data: debtsToCreate
            });
        }
        // Clean up file
        fs_1.default.unlinkSync(req.file.path);
        res.json({ message: `Successfully imported ${debtsToCreate.length} records` });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.importDebts = importDebts;
const getDebtTemplate = async (req, res) => {
    try {
        const workbook = new exceljs_1.default.Workbook();
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
    }
    catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.getDebtTemplate = getDebtTemplate;
const exportDebts = async (req, res) => {
    try {
        const debts = await prisma_1.default.debt.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
        });
        const workbook = new exceljs_1.default.Workbook();
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
        debts.forEach((d) => {
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
    }
    catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.exportDebts = exportDebts;
