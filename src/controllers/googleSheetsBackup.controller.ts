import { Request, Response } from "express";
import { google } from "googleapis";
import prisma from "../utils/prisma";

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

export const getServiceAccount = (req: Request, res: Response) => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!email) {
    return res.status(404).json({ message: "Service account not configured" });
  }
  return res.json({ email });
};

export const exportToGoogleSheets = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { spreadsheetId } = req.body;

    if (!spreadsheetId) {
      return res.status(400).json({ message: "Spreadsheet ID is required" });
    }

    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!clientEmail || !privateKey) {
      return res.status(500).json({
        message:
          "Google Sheets Service Account credentials are not configured on the server.",
      });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Fetch data
    const accounts = await prisma.account.findMany({ where: { userId } });
    const categories = await prisma.category.findMany({ where: { userId } });
    const transactions = await prisma.transaction.findMany({
      where: { userId },
    });
    const budgets = await prisma.budget.findMany({ where: { userId } });
    const goals = await prisma.goal.findMany({ where: { userId } });
    const debts = await prisma.debt.findMany({ where: { userId } });
    const plannedExpenses = await prisma.plannedExpense.findMany({
      where: { userId },
    });

    // Helper to format data to Sheet rows
    const createSheetData = (title: string, data: any[]) => {
      if (data.length === 0) return { title, rows: [["No data"]] };
      const headers = Object.keys(data[0]);
      const rows = data.map((item) =>
        headers.map((h) => String(item[h] ?? "")),
      );
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
    } catch (error: any) {
      console.error("Error accessing spreadsheet:", error.message);
      return res.status(400).json({
        message:
          "Could not access the spreadsheet. Make sure the ID is correct and you have shared it with the service account email.",
      });
    }

    const existingSheets =
      spreadsheet.data.sheets?.map((s) => s.properties?.title) || [];

    // Create missing sheets
    const missingSheets = sheetsData.filter(
      (d) => !existingSheets.includes(d.title),
    );
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
  } catch (error: any) {
    console.error("Google Sheets Backup error:", error);
    res.status(500).json({
      message: "Failed to backup to Google Sheets",
      error: error.message,
    });
  }
};
