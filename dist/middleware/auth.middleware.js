"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }
    try {
        const verified = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // Verify user exists in database to prevent foreign key errors
        const user = await prisma_1.default.user.findUnique({
            where: { id: verified.id },
            select: { id: true, email: true }
        });
        if (!user) {
            return res.status(401).json({ message: 'User no longer exists.' });
        }
        req.user = user;
        next();
    }
    catch (err) {
        res.status(403).json({ message: 'Invalid token.' });
    }
};
exports.authenticateToken = authenticateToken;
