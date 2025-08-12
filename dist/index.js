"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const BotController_1 = require("./controllers/BotController");
const SchedulerService_1 = require("./services/SchedulerService");
const database_1 = require("./utils/database");
const server_1 = require("./utils/server");
const logger_1 = require("./utils/logger");
dotenv_1.default.config();
async function main() {
    let botController = null;
    try {
        console.log('Telegram Purchase Bot starting...');
        console.log('Connecting to database...');
        await (0, database_1.initializeDatabase)();
        console.log('Starting webhook server...');
        const webhookServer = new server_1.WebhookServer();
        await webhookServer.start();
        botController = new BotController_1.BotController();
        await botController.launch();
        const scheduler = new SchedulerService_1.SchedulerService(botController.bot);
        scheduler.start();
        console.log('✅ Telegram Purchase Bot started successfully!');
        const gracefulShutdown = async (signal) => {
            console.log(`\n${signal} received. Shutting down gracefully...`);
            logger_1.logger.info(`${signal} received, initiating graceful shutdown`);
            try {
                if (botController) {
                    await botController.bot.stop(signal);
                    logger_1.logger.info('Bot stopped successfully');
                }
                const { closeDatabase } = await Promise.resolve().then(() => __importStar(require('./utils/database')));
                await closeDatabase();
                logger_1.logger.info('Database connection closed');
                console.log('✅ Graceful shutdown completed');
                process.exit(0);
            }
            catch (error) {
                logger_1.logger.error('Error during graceful shutdown:', error instanceof Error ? error : new Error(String(error)));
                process.exit(1);
            }
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }
    catch (error) {
        logger_1.logger.error('Failed to start application:', error instanceof Error ? error : new Error('Unknown error'));
        console.error('❌ Failed to start Telegram Purchase Bot:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    main().catch(console.error);
}
exports.default = main;
//# sourceMappingURL=index.js.map