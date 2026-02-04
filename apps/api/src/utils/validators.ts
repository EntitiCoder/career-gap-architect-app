import { z } from 'zod';
import { AnalysisRequest, AnalysisResult } from '../types/analysis';

const analysisRequestSchema = z.object({
    resume: z.string().min(10, 'Resume must be at least 10 characters long'),
    jobDescription: z.string().min(10, 'Job description must be at least 10 characters long'),
});

const analysisResultSchema = z.object({
    missingSkills: z.array(z.string()),
    steps: z.string(),
    interviewQuestions: z.string(),
});

export function validateAnalysisRequest(payload: unknown): AnalysisRequest {
    return analysisRequestSchema.parse(payload);
}

export function validateAnalysisResult(payload: unknown): AnalysisResult {
    return analysisResultSchema.parse(payload);
}

export function formatValidationErrors(error: z.ZodError): string[] {
    return error.issues.map((issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`);
}
