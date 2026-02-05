export class AIServiceError extends Error {
    public code: string;
    public statusCode?: number;
    public retryable: boolean;

    constructor(message: string, code: string, statusCode?: number, retryable: boolean = true) {
        super(message);
        this.name = 'AIServiceError';
        this.code = code;
        this.statusCode = statusCode;
        this.retryable = retryable;
    }
}

export class ParseError extends Error {
    public code: string;
    public details?: string;
    constructor(message: string, details?: string) {
        super(message);
        this.name = 'ParseError';
            this.code = 'PARSE_ERROR';
        this.details = details;
    }
}

export class ValidationError extends Error {
        public code: string;
    public details?: string[];
    constructor(message: string, details?: string[] | string) {
        super(message);
        this.name = 'ValidationError';
            this.code = 'VALIDATION_ERROR';
        if (Array.isArray(details)) {
            this.details = details;
        } else if (details) {
            this.details = [details];
        }
    }
}

export class TimeoutError extends Error {
        public code: string;
    public timeoutMs: number;
    constructor(message: string, timeoutMs: number) {
        super(message);
        this.name = 'TimeoutError';
            this.code = 'TIMEOUT_ERROR';
        this.timeoutMs = timeoutMs;
    }
}
