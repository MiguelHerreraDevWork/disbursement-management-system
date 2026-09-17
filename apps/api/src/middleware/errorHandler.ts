import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, ValidationError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "The requested resource was not found.",
      correlationId: req.id,
    },
  });
}

// body-parser (used internally by express.json()) throws a plain SyntaxError
// with a `status`/`statusCode` of 400 for a malformed JSON body — it is a
// client input error, not an unexpected server failure.
function isMalformedBodySyntaxError(err: unknown): err is SyntaxError {
  return (
    err instanceof SyntaxError &&
    ("status" in err && (err as { status?: unknown }).status === 400)
  );
}

// Express only treats a handler as error-handling middleware if it has 4 params.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError || isMalformedBodySyntaxError(err)) {
    const message =
      err instanceof ZodError
        ? err.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ")
        : "Request body is not valid JSON.";
    const validationError = new ValidationError(message);
    res.status(validationError.statusCode).json({
      error: { code: validationError.code, message: validationError.message, correlationId: req.id },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        correlationId: req.id,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  logger.error({ err, reqId: req.id }, "Unhandled error");
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      correlationId: req.id,
    },
  });
}
