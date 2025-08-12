"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookServer = void 0;
const express_1 = __importDefault(require("express"));
const PaymentCallbackController_1 = require("../controllers/PaymentCallbackController");
const logger_1 = require("./logger");
const config_1 = require("./config");
class WebhookServer {
    constructor() {
        this.app = (0, express_1.default)();
        this.callbackController = new PaymentCallbackController_1.PaymentCallbackController();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }
    setupMiddleware() {
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true }));
        this.app.use((req, res, next) => {
            logger_1.logger.info('Incoming request', {
                method: req.method,
                url: req.url,
                userAgent: req.get('User-Agent'),
                ip: req.ip
            });
            next();
        });
        this.app.use((req, res, next) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            next();
        });
    }
    setupRoutes() {
        this.app.get('/health', (req, res) => {
            this.callbackController.healthCheck(req, res);
        });
        this.app.post('/callback/mpesa', (req, res) => {
            this.callbackController.handleCallback(req, res);
        });
        this.app.post('/test/callback', (req, res) => {
            logger_1.logger.info('Test callback received', {
                body: req.body,
                headers: req.headers,
                timestamp: new Date().toISOString()
            });
            res.status(200).json({
                success: true,
                message: 'Test callback received successfully',
                timestamp: new Date().toISOString(),
                receivedData: req.body
            });
        });
        this.app.get('/', (req, res) => {
            res.status(200).json({
                success: true,
                message: 'Telegram Purchase Bot Webhook Server',
                version: '1.0.0',
                endpoints: {
                    health: '/health',
                    mpesaCallback: '/callback/mpesa'
                }
            });
        });
        this.app.use('*', (req, res) => {
            logger_1.logger.warn('Route not found', {
                method: req.method,
                url: req.url,
                ip: req.ip
            });
            res.status(404).json({
                success: false,
                message: 'Route not found',
                availableEndpoints: {
                    health: '/health',
                    mpesaCallback: '/callback/mpesa'
                }
            });
        });
    }
    setupErrorHandling() {
        this.app.use((error, req, res, next) => {
            logger_1.logger.error('Unhandled server error:', error, {
                method: req.method,
                url: req.url,
                ip: req.ip
            });
            const status = error.status || 500;
            const message = status === 500 ? 'Internal server error' : error.message;
            res.status(status).json({
                success: false,
                message,
                timestamp: new Date().toISOString()
            });
        });
    }
    async start() {
        return new Promise((resolve, reject) => {
            try {
                const config = (0, config_1.getConfig)();
                const server = this.app.listen(config.PORT, () => {
                    logger_1.logger.info(`Webhook server started on port ${config.PORT}`, {
                        port: config.PORT,
                        environment: process.env.NODE_ENV || 'development'
                    });
                    resolve();
                });
                server.on('error', (error) => {
                    logger_1.logger.error('Server error:', error);
                    reject(error);
                });
                process.on('SIGTERM', () => {
                    logger_1.logger.info('SIGTERM received, shutting down gracefully');
                    server.close(() => {
                        logger_1.logger.info('Server closed');
                        process.exit(0);
                    });
                });
                process.on('SIGINT', () => {
                    logger_1.logger.info('SIGINT received, shutting down gracefully');
                    server.close(() => {
                        logger_1.logger.info('Server closed');
                        process.exit(0);
                    });
                });
            }
            catch (error) {
                logger_1.logger.error('Failed to start server:', error instanceof Error ? error : new Error(String(error)));
                reject(error);
            }
        });
    }
    getApp() {
        return this.app;
    }
}
exports.WebhookServer = WebhookServer;
//# sourceMappingURL=server.js.map