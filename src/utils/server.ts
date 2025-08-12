import express, { Application, Request, Response, NextFunction } from 'express';
import { PaymentCallbackController } from '../controllers/PaymentCallbackController';
import { logger } from './logger';
import { getConfig } from './config';

export interface ServerError extends Error {
  status?: number;
}

export class WebhookServer {
  private app: Application;
  private callbackController: PaymentCallbackController;

  constructor() {
    this.app = express();
    this.callbackController = new PaymentCallbackController();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Parse JSON bodies
    this.app.use(express.json({ limit: '10mb' }));
    
    // Parse URL-encoded bodies
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      next();
    });

    // Security headers
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      this.callbackController.healthCheck(req, res);
    });

    // Mpesa callback endpoint
    this.app.post('/callback/mpesa', (req: Request, res: Response) => {
      this.callbackController.handleCallback(req, res);
    });

    // Test callback endpoint for debugging
    this.app.post('/test/callback', (req: Request, res: Response) => {
      logger.info('Test callback received', { 
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

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
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

    // 404 handler for unknown routes
    this.app.use('*', (req: Request, res: Response) => {
      logger.warn('Route not found', {
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

  /**
   * Setup error handling middleware
   */
  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: ServerError, req: Request, res: Response, next: NextFunction) => {
      logger.error('Unhandled server error:', error, {
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

  /**
   * Start the webhook server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const config = getConfig();
        const server = this.app.listen(config.PORT, () => {
          logger.info(`Webhook server started on port ${config.PORT}`, {
            port: config.PORT,
            environment: process.env.NODE_ENV || 'development'
          });
          resolve();
        });

        // Handle server errors
        server.on('error', (error: Error) => {
          logger.error('Server error:', error);
          reject(error);
        });

        // Graceful shutdown handling
        process.on('SIGTERM', () => {
          logger.info('SIGTERM received, shutting down gracefully');
          server.close(() => {
            logger.info('Server closed');
            process.exit(0);
          });
        });

        process.on('SIGINT', () => {
          logger.info('SIGINT received, shutting down gracefully');
          server.close(() => {
            logger.info('Server closed');
            process.exit(0);
          });
        });

      } catch (error) {
        logger.error('Failed to start server:', error instanceof Error ? error : new Error(String(error)));
        reject(error);
      }
    });
  }

  /**
   * Get the Express application instance (useful for testing)
   */
  getApp(): Application {
    return this.app;
  }
}