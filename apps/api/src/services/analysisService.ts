/**
 * Analysis Service - Handles AI-powered gap analysis with retry logic and model fallback
 */

import { ZodError } from 'zod';
import { AnalysisResult } from '../types/analysis';
import { AIServiceError, ParseError, TimeoutError, ValidationError } from '../utils/errors';
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
            console.log(`[AI Service] Trying model: ${model}`);
            const result = await callAIServiceWithModel(
                resume,
                jobDescription,
                apiKey,
                model,
                config
            );
            
            // Mark model as working
            markModelStatus(model, true);
            console.log(`[AI Service] Success with model: ${model}`);
            
            return result;
        } catch (error) {
            lastError = error as Error;
            
            const statusCode = error instanceof AIServiceError ? error.statusCode : undefined;
            
            // If it's a 404 (model not found), mark as not working and try next
            if (statusCode === 404) {
                markModelStatus(model, false);
                console.warn(`[AI Service] Model not available: ${model}, trying next...`);
                continue;
            }
            
            // If it's another non-retryable error, mark as not working and try next
            if (error instanceof AIServiceError && !error.retryable) {
                markModelStatus(model, false);
                console.warn(`[AI Service] Non-retryable error with ${model}: ${error.message}, trying next...`);
                continue;
            }
            
            // For retryable errors, continue to next model
            console.warn(`[AI Service] Error with ${model}: ${error}, trying next...`);
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
            console.log(`[AI Service] Attempt ${attempt + 1}/${config.maxAttempts} with ${model} - Resume length: ${resume.length} chars, Job description length: ${jobDescription.length} chars`);

            const prompt = `Analyze the gap between this resume and job description. Return ONLY valid JSON with this exact structure:
{
  "missingSkills": ["skill1", "skill2"],
  "steps": "# Action Plan\\n- Step 1\\n- Step 2",
  "interviewQuestions": "# Interview Prep\\n- Question 1\\n- Question 2"
}

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
                    console.error(`[AI Service] Non-retryable error (${response.status}): ${errorText}`);
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

            console.log(`[AI Service] Success on attempt ${attempt + 1}`);
            return result;

        } catch (error) {
            lastError = error as Error;
            const isLastAttempt = attempt === config.maxAttempts - 1;

            // Log the error with context
            if (error instanceof AIServiceError) {
                console.error(`[AI Service] Attempt ${attempt + 1} failed - ${error.code}: ${error.message}`);
                
                // Don't retry non-retryable errors
                if (!error.retryable) {
                    throw error;
                }
            } else if (error instanceof ParseError) {
                console.error(`[AI Service] Attempt ${attempt + 1} failed - Parse error: ${error.message}`);
            } else if (error instanceof ValidationError) {
                console.error(`[AI Service] Attempt ${attempt + 1} failed - Validation error: ${error.message}`, error.details);
            } else if (error instanceof TimeoutError) {
                console.error(`[AI Service] Attempt ${attempt + 1} failed - Timeout: ${error.message}`);
            } else {
                console.error(`[AI Service] Attempt ${attempt + 1} failed - ${error}`);
            }

            // If this is the last attempt, throw the error
            if (isLastAttempt) {
                throw lastError;
            }

            // Calculate backoff delay and wait before retry
            const backoffDelay = calculateBackoff(attempt, config.baseDelayMs, config.maxJitterMs);
            console.log(`[AI Service] Retrying in ${Math.round(backoffDelay)}ms...`);
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
 * Validate and format the parsed result
 * @param parsed - Parsed object from AI response
 * @returns Validated and formatted analysis result
 */
export function validateAndFormatResult(parsed: any): AnalysisResult {
    try {
        // Use Zod validator for strict type checking
        const validated = validateAnalysisResult(parsed);
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

        throw error;
    }
}
