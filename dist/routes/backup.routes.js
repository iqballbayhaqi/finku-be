"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const backup_controller_1 = require("../controllers/backup.controller");
const router = express_1.default.Router();
router.get('/export', auth_middleware_1.authenticateToken, backup_controller_1.exportData);
const backup_controller_2 = require("../controllers/backup.controller");
router.post('/restore', auth_middleware_1.authenticateToken, backup_controller_2.restoreData);
exports.default = router;
