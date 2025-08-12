// Main application entry point
import dotenv from 'dotenv';
import { BotController } from './controllers/BotController';
import { SchedulerService } from './services/SchedulerService';
import { initializeDatabase } from './utils/database';
import { WebhookServer } from './utils/server';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

async function main() {
  let botController: BotController | null = null;
  
  try {
    console.log('Telegram Purchase Bot starting...');
    
    // Initialize database connection first
    console.log('Connecting to database...');
    await initializeDatabase();
    
    // Start the webhook server for payment callbacks
    console.log('Starting webhook server...');
    const webhookServer = new WebhookServer();
    await webhookServer.start();
    
    // Start the bot controller
    botController = new BotController();
    await botController.launch();
    
    // Start the scheduler service
    const scheduler = new SchedulerService(botController.bot);
    scheduler.start();
    
    console.log('✅ Telegram Purchase Bot started successfully!');
    
    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      logger.info(`${signal} received, initiating graceful shutdown`);
      
      try {
        if (botController) {
          await botController.bot.stop(signal);
          logger.info('Bot stopped successfully');
        }
        
        // Close database connection
        const { closeDatabase } = await import('./utils/database');
        await closeDatabase();
        logger.info('Database connection closed');
        
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error instanceof Error ? error : new Error(String(error)));
        process.exit(1);
      }
    };
    
    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    logger.error('Failed to start application:', error instanceof Error ? error : new Error('Unknown error'));
    console.error('❌ Failed to start Telegram Purchase Bot:', error);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  main().catch(console.error);
}

export default main;