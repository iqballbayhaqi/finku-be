"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportToGoogleSheets = exports.getServiceAccount = void 0;
const googleapis_1 = require("googleapis");
const prisma_1 = __importDefault(require("../utils/prisma"));
const getServiceAccount = (req, res) => {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    if (!email) {
        return res.status(404).json({ message: "Service account not configured" });
    }
    return res.json({ email });
};
exports.getServiceAccount = getServiceAccount;
const exportToGoogleSheets = async (req, res) => {
    try {
        const userId = req.user.id;
        const { spreadsheetId } = req.body;
        if (!spreadsheetId) {
            return res.status(400).json({ message: "Spreadsheet ID is required" });
        }
        const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
        if (!clientEmail || !privateKey) {
            return res.status(500).json({
                message: "Google Sheets Service Account credentials are not configured on the server.",
            });
        }
        const auth = new googleapis_1.google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey,
            },
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
        const sheets = googleapis_1.google.sheets({ version: "v4", auth });
        // Fetch data
        const accounts = await prisma_1.default.account.findMany({ where: { userId } });
        const categories = await prisma_1.default.category.findMany({ where: { userId } });
        const transactions = await prisma_1.default.transaction.findMany({
            where: { userId },
        });
        const budgets = await prisma_1.default.budget.findMany({ where: { userId } });
        const goals = await prisma_1.default.goal.findMany({ where: { userId } });
        const debts = await prisma_1.default.debt.findMany({ where: { userId } });
        const plannedExpenses = await prisma_1.default.plannedExpense.findMany({
            where: { userId },
        });
        // Helper to format data to Sheet rows
        const createSheetData = (title, data) => {
            if (data.length === 0)
                return { title, rows: [["No data"]] };
            const headers = Object.keys(data[0]);
            const rows = data.map((item) => headers.map((h) => String(item[h] ?? "")));
            return { title, rows: [headers, ...rows] };
        };
        const sheetsData = [
            createSheetData("Accounts", accounts),
            createSheetData("Categories", categories),
            createSheetData("Transactions", transactions),
            createSheetData("Budgets", budgets),
            createSheetData("Goals", goals),
            createSheetData("Debts", debts),
            createSheetData("PlannedExpenses", plannedExpenses),
        ];
        // First, get the spreadsheet to see existing sheets
        let spreadsheet;
        try {
            spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        }
        catch (error) {
            console.error("Error accessing spreadsheet:", error.message);
            return res.status(400).json({
                message: "Could not access the spreadsheet. Make sure the ID is correct and you have shared it with the service account email.",
            });
        }
        const existingSheets = spreadsheet.data.sheets?.map((s) => s.properties?.title) || [];
        // Create missing sheets
        const missingSheets = sheetsData.filter((d) => !existingSheets.includes(d.title));
        if (missingSheets.length > 0) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: missingSheets.map((s) => ({
                        addSheet: {
                            properties: {
                                title: s.title,
                            },
                        },
                    })),
                },
            });
        }
        // Clear existing data to avoid leftover rows
        await sheets.spreadsheets.values.batchClear({
            spreadsheetId,
            requestBody: {
                ranges: sheetsData.map((d) => `'${d.title}'!A1:Z10000`),
            },
        });
        const dataObj = sheetsData.map((d) => ({
            range: `'${d.title}'!A1`,
            values: d.rows,
        }));
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                valueInputOption: "USER_ENTERED",
                data: dataObj,
            },
        });
        res.json({ message: "Backup to Google Sheets successful!" });
    }
    catch (error) {
        console.error("Google Sheets Backup error:", error);
        res.status(500).json({
            message: "Failed to backup to Google Sheets",
            error: error.message,
        });
    }
};
exports.exportToGoogleSheets = exportToGoogleSheets;
