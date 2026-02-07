import { JSDOM } from 'jsdom';
import { z } from 'zod';
import { AnalysisRequest, AnalysisResult } from '../types/analysis';

// Create a DOMPurify instance for server-side sanitization
const window = new JSDOM('').window;
const DOMPurify = require('dompurify')(window);

// Maximum length constraints
const MAX_RESUME_LENGTH = 50000; // 50k characters
const MAX_JOB_DESCRIPTION_LENGTH = 20000; // 20k characters

/**
 * Sanitize input to prevent XSS attacks
 * Removes HTML tags and potentially malicious content
 */
export function sanitizeInput(input: string): string {
    // First, sanitize with DOMPurify to remove any HTML/script tags
    const sanitized = DOMPurify.sanitize(input, {
        ALLOWED_TAGS: [], // Strip all HTML tags
        ALLOWED_ATTR: [], // Strip all attributes
        KEEP_CONTENT: true, // Keep text content
    });

    // Trim whitespace
    return sanitized.trim();
}

const analysisRequestSchema = z.object({
    resume: z.string()
        .min(10, 'Resume must be at least 10 characters long')
        .max(MAX_RESUME_LENGTH, `Resume exceeds maximum length of ${MAX_RESUME_LENGTH.toLocaleString()} characters`)
        .transform(sanitizeInput)
        .refine(
            (val) => val.length >= 10,
            'Resume must contain actual content, not just whitespace'
        ),
    jobDescription: z.string()
        .min(10, 'Job description must be at least 10 characters long')
        .max(MAX_JOB_DESCRIPTION_LENGTH, `Job description exceeds maximum length of ${MAX_JOB_DESCRIPTION_LENGTH.toLocaleString()} characters`)
        .transform(sanitizeInput)
        .refine(
            (val) => val.length >= 10,
            'Job description must contain actual content, not just whitespace'
        ),
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
