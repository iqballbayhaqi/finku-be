import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

import authRoutes from './routes/auth.routes';
import categoryRoutes from './routes/category.routes';
import transactionRoutes from './routes/transaction.routes';
import budgetRoutes from './routes/budget.routes';
import goalRoutes from './routes/goal.routes';
import debtRoutes from './routes/debt.routes';
import accountRoutes from './routes/account.routes';
import dashboardRoutes from './routes/dashboard.routes';
import backupRoutes from './routes/backup.routes';
import plannedExpenseRoutes from './routes/plannedExpense.routes';

// CORS: izinkan frontend origin dan header Authorization (agar backup/export tidak "blocked")
const corsOptions = {
  origin: process.env.FRONTEND_ORIGIN || true, // true = reflect request origin; atau set e.g. http://localhost:5173
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/debts', debtRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/planned-expenses', plannedExpenseRoutes);

app.get('/', (req, res) => {
  res.send('Finnan API is running');
});

export default app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
