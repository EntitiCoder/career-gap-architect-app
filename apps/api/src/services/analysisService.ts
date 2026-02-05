/**
 * Analysis Service - Handles AI-powered gap analysis with retry logic and model fallback
 */

import { ZodError } from 'zod';
import { AnalysisResult } from '../types/analysis';
import { AIServiceError, ParseError, TimeoutError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import { formatValidationErrors, validateAnalysisResult } from '../utils/validators';

interface RetryConfig {
    maxAttempts: number;
    baseDelayMs: number;
    maxJitterMs: number;
    timeoutMs: number;
}

// List of free models to try in order of preference
const FREE_MODELS = [
    'arcee-ai/trinity-large-preview:free',
    'stepfun/step-3.5-flash:free',
    'upstage/solar-pro-3:free',
    'liquid/lfm-2.5-1.2b-thinking:free',
];

// Track which models are currently working
const modelCache = new Map<string, { isWorking: boolean; lastChecked: number }>();

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxJitterMs: 500,
    timeoutMs: 30000,
};

/**
 * Get the next available model to try
 * @param preferredModel - Model to try first
 * @returns Array of models to try in order
 */
function getModelsToTry(preferredModel: string): string[] {
    const models = [preferredModel];

    // Add other free models as fallback
    for (const model of FREE_MODELS) {
        if (model !== preferredModel) {
            models.push(model);
        }
    }

    // Sort by likelihood of working (cached working models first)
    return models.sort((a, b) => {
        const aCache = modelCache.get(a);
        const bCache = modelCache.get(b);

        const aWorking = aCache?.isWorking ?? true;
        const bWorking = bCache?.isWorking ?? true;

        return (bWorking ? 1 : 0) - (aWorking ? 1 : 0);
    });
}

/**
 * Mark a model as working or not working
 */
function markModelStatus(model: string, isWorking: boolean): void {
    modelCache.set(model, { isWorking, lastChecked: Date.now() });
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxJitterMs - Maximum jitter to add
 * @returns Delay in milliseconds
 */
function calculateBackoff(attempt: number, baseDelayMs: number, maxJitterMs: number): number {
    // Exponential backoff: 1s, 3s, 9s (3^attempt * baseDelay)
    const exponentialDelay = Math.pow(3, attempt) * baseDelayMs;
    // Add random jitter to prevent thundering herd
    const jitter = Math.random() * maxJitterMs;
    return exponentialDelay + jitter;
}

/**
 * Determine if an error is retryable
 * @param error - Error to check
 * @param statusCode - HTTP status code if available
 * @returns true if the error should be retried
 */
function isRetryableError(error: any, statusCode?: number): boolean {
    // Don't retry on 4xx errors (client errors)
    if (statusCode && statusCode >= 400 && statusCode < 500) {
        return false;
    }

    // Retry on 5xx errors (server errors)
    if (statusCode && statusCode >= 500) {
        return true;
    }

    // Retry on network errors
    const errorMessage = error?.message?.toLowerCase() || '';
    const networkErrors = ['fetch', 'network', 'timeout', 'econnrefused', 'enotfound', 'etimedout'];
    if (networkErrors.some(keyword => errorMessage.includes(keyword))) {
        return true;
    }

    // Default to retryable for unknown errors
    return true;
}

/**
 * Call AI service with retry logic and model fallback
 * @param resume - Resume text
 * @param jobDescription - Job description text
 * @param apiKey - OpenRouter API key
 * @param preferredModel - Preferred model to use first (default: first free model)
 * @param config - Retry configuration
 * @returns Analysis result with model info
 */
export async function callAIService(
    resume: string,
    jobDescription: string,
    apiKey: string,
    preferredModel: string = FREE_MODELS[0],
    config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<AnalysisResult> {
    const modelsToTry = getModelsToTry(preferredModel);
    let lastError: Error | null = null;

    for (const model of modelsToTry) {
        try {
            logger.info('[AI Service] Trying model', { model });
            const result = await callAIServiceWithModel(
                resume,
                jobDescription,
                apiKey,
                model,
                config
            );

            // Mark model as working
            markModelStatus(model, true);
            logger.info('[AI Service] Success with model', { model });

            return result;
        } catch (error) {
            lastError = error as Error;

            const statusCode = error instanceof AIServiceError ? error.statusCode : undefined;

            // If it's a 404 (model not found), mark as not working and try next
            if (statusCode === 404) {
                markModelStatus(model, false);
                logger.warn('[AI Service] Model not available, trying next', { model });
                continue;
            }

            // If it's another non-retryable error, mark as not working and try next
            if (error instanceof AIServiceError && !error.retryable) {
                markModelStatus(model, false);
                logger.warn('[AI Service] Non-retryable error, trying next', { model, message: error.message });
                continue;
            }

            // For retryable errors, continue to next model
            logger.warn('[AI Service] Error with model, trying next', { model, error: String(error) });
            continue;
        }
    }

    // All models failed
    throw new AIServiceError(
        `All available models failed. Last error: ${lastError?.message || 'Unknown'}`,
        'ALL_MODELS_FAILED',
        undefined,
        false
    );
}

/**
 * Call AI service with a specific model
 * @param resume - Resume text
 * @param jobDescription - Job description text
 * @param apiKey - OpenRouter API key
 * @param model - Model to use
 * @param config - Retry configuration
 * @returns Analysis result
 */
async function callAIServiceWithModel(
    resume: string,
    jobDescription: string,
    apiKey: string,
    model: string,
    config: RetryConfig
): Promise<AnalysisResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
        // Check total timeout
        const elapsed = Date.now() - startTime;
        if (elapsed >= config.timeoutMs) {
            throw new TimeoutError(
                `Operation timed out after ${elapsed}ms (max: ${config.timeoutMs}ms)`,
                config.timeoutMs
            );
        }

        try {
            logger.info('[AI Service] Attempt', {
                attempt: attempt + 1,
                maxAttempts: config.maxAttempts,
                model,
                resumeLength: resume.length,
                jobDescLength: jobDescription.length
            });

            const prompt = `You are a career gap analysis expert. Analyze the gap between the resume and job description.
            
EXTRACT:
1. Missing Skills: List only technical technologies present in the JD but absent in the Resume.
2. Steps: Provide EXACTLY 3 concrete project-based steps.
3. Questions: Provide EXACTLY 3 specific interview questions.

STRICT CONSTRAINTS:
- You MUST provide EXACTLY 3 steps and EXACTLY 3 questions. DO NOT provide 2, and DO NOT provide 4 or more.
- Return ONLY valid JSON. No conversational text.
- Use markdown list format within the JSON strings.

JSON STRUCTURE:
{
  "missingSkills": ["skill1", "skill2"],
  "steps": "# Action Plan\\n- Step 1\\n- Step 2\\n- Step 3",
  "interviewQuestions": "# Interview Prep\\n- Question 1\\n- Question 2\\n- Question 3"
}

DATA:
Resume:
${resume}

Job Description:
${jobDescription}`;

            // Create timeout promise
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(new TimeoutError(
                        `Request timed out after ${config.timeoutMs}ms`,
                        config.timeoutMs
                    ));
                }, config.timeoutMs - elapsed);
            });

            // Create fetch promise
            const fetchPromise = fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: prompt }],
                }),
            });

            // Race between fetch and timeout
            const response = await Promise.race([fetchPromise, timeoutPromise]);

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unable to read error response');
                const error = new AIServiceError(
                    `AI service returned ${response.status}: ${response.statusText}`,
                    'AI_SERVICE_ERROR',
                    response.status,
                    isRetryableError(null, response.status)
                );

                if (!error.retryable) {
                    logger.error('[AI Service] Non-retryable error', {
                        status: response.status,
                        error: errorText
                    });
                    throw error;
                }

                throw error;
            }

            const data: any = await response.json();
            const content = data.choices?.[0]?.message?.content;

            if (!content) {
                throw new AIServiceError(
                    'AI service returned empty response',
                    'EMPTY_RESPONSE',
                    undefined,
                    true
                );
            }

            // Parse and validate the response
            const parsed = parseAIResponse(content);
            const result = validateAndFormatResult(parsed);

            logger.info('[AI Service] Success on attempt', { attempt: attempt + 1 });
            return result;

        } catch (error) {
            lastError = error as Error;
            const isLastAttempt = attempt === config.maxAttempts - 1;

            // Log the error with context
            if (error instanceof AIServiceError) {
                logger.error('[AI Service] Attempt failed - AIServiceError', {
                    attempt: attempt + 1,
                    code: error.code,
                    message: error.message
                });

                // Don't retry non-retryable errors
                if (!error.retryable) {
                    throw error;
                }
            } else if (error instanceof ParseError) {
                logger.error('[AI Service] Attempt failed - ParseError', {
                    attempt: attempt + 1,
                    message: error.message
                });
            } else if (error instanceof ValidationError) {
                logger.error('[AI Service] Attempt failed - ValidationError', {
                    attempt: attempt + 1,
                    message: error.message,
                    details: error.details
                });
            } else if (error instanceof TimeoutError) {
                logger.error('[AI Service] Attempt failed - TimeoutError', {
                    attempt: attempt + 1,
                    message: error.message
                });
            } else {
                logger.error('[AI Service] Attempt failed - Unknown error', {
                    attempt: attempt + 1,
                    error: String(error)
                });
            }

            // If this is the last attempt, throw the error
            if (isLastAttempt) {
                throw lastError;
            }

            // Calculate backoff delay and wait before retry
            const backoffDelay = calculateBackoff(attempt, config.baseDelayMs, config.maxJitterMs);
            logger.info('[AI Service] Retrying', { delayMs: Math.round(backoffDelay) });
            await sleep(backoffDelay);
        }
    }

    // Should never reach here, but just in case
    throw lastError || new AIServiceError(
        'All retry attempts failed',
        'MAX_RETRIES_EXCEEDED',
        undefined,
        false
    );
}

/**
 * Parse AI response and extract JSON
 * @param content - Raw AI response content
 * @returns Parsed object
 */
export function parseAIResponse(content: string): any {
    try {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            throw new ParseError(
                'No JSON found in AI response',
                content.substring(0, 200) // Include first 200 chars for debugging
            );
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return parsed;
    } catch (error) {
        if (error instanceof ParseError) {
            throw error;
        }

        if (error instanceof SyntaxError) {
            throw new ParseError(
                `Failed to parse JSON: ${error.message}`,
                content.substring(0, 200)
            );
        }

        throw new ParseError(
            `Unexpected error parsing response: ${error}`,
            content.substring(0, 200)
        );
    }
}

/**
 * Truncate a markdown list to exactly N items
 */
function truncateMarkdownList(text: string, count: number): string {
    const lines = text.split('\n');
    const headerLines: string[] = [];
    const listItems: string[] = [];

    for (const line of lines) {
        if (line.trim().startsWith('- ') || /^\d+\./.test(line.trim())) {
            listItems.push(line);
        } else if (listItems.length === 0) {
            headerLines.push(line);
        }
    }

    return [...headerLines, ...listItems.slice(0, count)].join('\n');
}

/**
 * Validate and format the parsed result
 * @param parsed - Parsed object from AI response
 * @returns Validated and formatted analysis result
 */
export function validateAndFormatResult(parsed: any): AnalysisResult {
    try {
        // Use Zod validator for strict type checking
        const validated = validateAnalysisResult(parsed);

        // Post-processing to enforce "exactly 3" if the AI failed to follow instructions
        validated.steps = truncateMarkdownList(validated.steps, 3);
        validated.interviewQuestions = truncateMarkdownList(validated.interviewQuestions, 3);

        return validated;
    } catch (error) {
        if (error instanceof ZodError) {
            const formattedErrors = formatValidationErrors(error);
            throw new ValidationError(
                'AI response validation failed - invalid structure',
                formattedErrors
            );
        }

        // Fallback validation for non-Zod errors
        if (!parsed || typeof parsed !== 'object') {
            throw new ValidationError('AI response is not a valid object');
        }

        if (!Array.isArray(parsed.missingSkills)) {
            throw new ValidationError('Missing or invalid "missingSkills" field');
        }

        if (typeof parsed.steps !== 'string') {
            throw new ValidationError('Missing or invalid "steps" field');
        }

        if (typeof parsed.interviewQuestions !== 'string') {
            throw new ValidationError('Missing or invalid "interviewQuestions" field');
        }

        const result: AnalysisResult = {
            missingSkills: parsed.missingSkills,
            steps: truncateMarkdownList(parsed.steps, 3),
            interviewQuestions: truncateMarkdownList(parsed.interviewQuestions, 3)
        };

        return result;
    }
}
