export interface AnalysisRequest {
    resume: string;
    jobDescription: string;
}

export interface AnalysisResult {
    missingSkills: string[];
    steps: string;
    interviewQuestions: string;
    cached?: boolean;
    metadata?: {
        processingTime: number;
        cacheSource?: 'memory' | 'database' | 'ai';
        model?: string;
        timestamp?: string;
        version?: string;
    };
}

export interface ErrorResponse {
    error: string;
    validationErrors?: string[];
    details?: string;
    code?: string;
}
