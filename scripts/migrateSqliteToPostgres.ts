import Database from 'better-sqlite3';
import prisma from '../src/utils/prisma';

const sqlitePath = 'prisma/dev.db.backup_20250208_1505';

async function truncateAll() {
  const tables = ['PlannedExpense', 'Transaction', 'Debt', 'Budget', 'Goal', 'Account', 'Category', 'User'];
  const truncSql = `TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`;
  await prisma.$executeRawUnsafe(truncSql);
}

function rows(db: any, table: string) {
  return db.prepare(`SELECT * FROM "${table}"`).all();
}

async function main() {
  const db = new Database(sqlitePath, { readonly: true });

  await truncateAll();

  const users = rows(db, 'User');
  for (const user of users) {
    await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        password: user.password,
        name: user.name,
        currency: user.currency,
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt),
      },
    });
  }

  const accounts = rows(db, 'Account');
  for (const account of accounts) {
    await prisma.account.create({
      data: {
        id: account.id,
        name: account.name,
        type: account.type,
        balance: account.balance,
        stockSymbol: account.stockSymbol,
        quantity: account.quantity,
        imageUrl: account.imageUrl,
        userId: account.userId,
        createdAt: new Date(account.createdAt),
        updatedAt: new Date(account.updatedAt),
        goalId: account.goalId,
      },
    });
  }

  const categories = rows(db, 'Category');
  for (const category of categories) {
    await prisma.category.create({
      data: {
        id: category.id,
        name: category.name,
        type: category.type,
        userId: category.userId,
        createdAt: new Date(category.createdAt),
      },
    });
  }

  const goals = rows(db, 'Goal');
  for (const goal of goals) {
    await prisma.goal.create({
      data: {
        id: goal.id,
        name: goal.name,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        imageUrl: goal.imageUrl,
        deadline: goal.deadline ? new Date(goal.deadline) : null,
        status: goal.status,
        userId: goal.userId,
        accountId: goal.accountId,
        createdAt: new Date(goal.createdAt),
        updatedAt: new Date(goal.updatedAt),
      },
    });
  }

  const debts = rows(db, 'Debt');
  for (const debt of debts) {
    await prisma.debt.create({
      data: {
        id: debt.id,
        personName: debt.personName,
        amount: debt.amount,
        dueDate: debt.dueDate ? new Date(debt.dueDate) : null,
        type: debt.type,
        status: debt.status,
        description: debt.description,
        totalInstallments: debt.totalInstallments,
        currentInstallment: debt.currentInstallment,
        userId: debt.userId,
        createdAt: new Date(debt.createdAt),
        updatedAt: new Date(debt.updatedAt),
      },
    });
  }

  const budgets = rows(db, 'Budget');
  for (const budget of budgets) {
    await prisma.budget.create({
      data: {
        id: budget.id,
        amount: budget.amount,
        month: budget.month,
        year: budget.year,
        categoryId: budget.categoryId,
        userId: budget.userId,
        createdAt: new Date(budget.createdAt),
        updatedAt: new Date(budget.updatedAt),
      },
    });
  }

  const transactions = rows(db, 'Transaction');
  for (const tx of transactions) {
    await prisma.transaction.create({
      data: {
        id: tx.id,
        amount: tx.amount,
        date: new Date(tx.date),
        description: tx.description,
        type: tx.type,
        categoryId: tx.categoryId,
        accountId: tx.accountId,
        goalId: tx.goalId,
        debtId: tx.debtId,
        userId: tx.userId,
        targetAccountId: tx.targetAccountId,
        createdAt: new Date(tx.createdAt),
        updatedAt: new Date(tx.updatedAt),
      },
    });
  }

  const planned = rows(db, 'PlannedExpense');
  for (const pe of planned) {
    await prisma.plannedExpense.create({
      data: {
        id: pe.id,
        amount: pe.amount,
        date: new Date(pe.date),
        description: pe.description,
        status: pe.status,
        categoryId: pe.categoryId,
        accountId: pe.accountId,
        userId: pe.userId,
        transactionId: pe.transactionId,
        createdAt: new Date(pe.createdAt),
        updatedAt: new Date(pe.updatedAt),
      },
    });
  }

  db.close();
}

main()
  .catch((e) => {
    console.error('Migration failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
