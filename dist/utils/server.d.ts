import { Application } from 'express';
export interface ServerError extends Error {
    status?: number;
}
export declare class WebhookServer {
    private app;
    private callbackController;
    constructor();
    private setupMiddleware;
    private setupRoutes;
    private setupErrorHandling;
    start(): Promise<void>;
    getApp(): Application;
}
//# sourceMappingURL=server.d.ts.map