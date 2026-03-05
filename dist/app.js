"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const category_routes_1 = __importDefault(require("./routes/category.routes"));
const transaction_routes_1 = __importDefault(require("./routes/transaction.routes"));
const budget_routes_1 = __importDefault(require("./routes/budget.routes"));
const goal_routes_1 = __importDefault(require("./routes/goal.routes"));
const debt_routes_1 = __importDefault(require("./routes/debt.routes"));
const account_routes_1 = __importDefault(require("./routes/account.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const backup_routes_1 = __importDefault(require("./routes/backup.routes"));
const plannedExpense_routes_1 = __importDefault(require("./routes/plannedExpense.routes"));
// CORS: izinkan frontend origin dan header Authorization (agar backup/export tidak "blocked")
const corsOptions = {
    origin: process.env.FRONTEND_ORIGIN || true, // true = reflect request origin; atau set e.g. http://localhost:5173
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
app.use('/api/auth', auth_routes_1.default);
app.use('/api/categories', category_routes_1.default);
app.use('/api/transactions', transaction_routes_1.default);
app.use('/api/budgets', budget_routes_1.default);
app.use('/api/goals', goal_routes_1.default);
app.use('/api/debts', debt_routes_1.default);
app.use('/api/accounts', account_routes_1.default);
app.use('/api/dashboard', dashboard_routes_1.default);
app.use('/api/backup', backup_routes_1.default);
app.use('/api/planned-expenses', plannedExpense_routes_1.default);
app.get('/', (req, res) => {
    res.send('Finnan API is running');
});
exports.default = app;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}
