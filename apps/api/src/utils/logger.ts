import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});

export function logRequest(method: string, endpoint: string, meta: Record<string, any> = {}) {
    logger.info(`: ${method} ${endpoint}`, { service: 'gap-analysis-api', method, endpoint, ...meta });
}

export function logCache(action: 'hit' | 'miss', cacheType: 'memory' | 'database', meta: Record<string, any> = {}) {
    logger.info(`: Cache ${action} (${cacheType})`, { service: 'gap-analysis-api', cacheType, action, ...meta });
}

export function logDatabase(operation: string, status: 'start' | 'success' | 'error', meta: Record<string, any> = {}) {
    logger.info(`: Database ${operation}: ${status}`, { service: 'gap-analysis-api', operation, status, ...meta });
}

export function logAICall(model: string, status: 'start' | 'success' | 'error', meta: Record<string, any> = {}) {
    logger.info(`: AI API call: ${status}`, { service: 'gap-analysis-api', model, status, ...meta });
}

export default logger;
