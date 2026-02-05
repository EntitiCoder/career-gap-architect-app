import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { formatValidationErrors, validateAnalysisRequest } from '../utils/validators';

export function inputValidatorMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        validateAnalysisRequest(req.body);
        return next();
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                error: 'Validation failed',
                validationErrors: formatValidationErrors(error),
            });
        }
        return res.status(400).json({
            error: 'Validation failed',
        });
    }
}
