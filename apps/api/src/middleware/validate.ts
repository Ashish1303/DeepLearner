import type { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../common/errors/app-error.js';

// Only schema-declared object keys and array indices may enter a public path.
// Records, opaque transforms, and unknown keys stop at the last known parent.
function safeField(schema: z.ZodType, path: PropertyKey[]): string {
  let current = schema;
  const segments: string[] = [];
  for (const part of path.slice(0, 5)) {
    if (
      current instanceof z.ZodObject &&
      typeof part === 'string' &&
      /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/.test(part) &&
      Object.hasOwn(current.shape, part)
    ) {
      segments.push(part);
      current = current.shape[part];
    } else if (
      current instanceof z.ZodArray &&
      typeof part === 'number' &&
      Number.isSafeInteger(part) &&
      part >= 0 &&
      part <= 9999
    ) {
      segments.push(String(part));
      if (!(current.element instanceof z.ZodType)) break;
      current = current.element;
    } else {
      break;
    }
  }
  return segments.join('.') || 'request';
}

function safeMessage(code: z.core.$ZodIssue['code']): string {
  switch (code) {
    case 'unrecognized_keys':
      return 'Unknown fields are not allowed';
    case 'invalid_type':
      return 'Missing or invalid value type';
    case 'too_small':
      return 'Value is below the allowed minimum';
    case 'too_big':
      return 'Value exceeds the allowed maximum';
    case 'invalid_format':
      return 'Invalid value format';
    default:
      return 'Invalid value';
  }
}

/** Validate at the HTTP boundary; handlers receive schema output, not raw input. */
export function validateRequest<S extends z.ZodType>(
  schema: S,
  handler: (
    req: Request,
    res: Response,
    input: z.output<S>,
  ) => void | Promise<void>,
): RequestHandler {
  return async (req, res) => {
    const result = await schema.safeParseAsync({
      body: req.body,
      params: req.params,
      query: req.query,
    });
    if (!result.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Request validation failed',
        result.error.issues.slice(0, 20).map((issue) => ({
          field: safeField(schema, issue.path),
          message: safeMessage(issue.code),
        })),
      );
    }
    await handler(req, res, result.data);
  };
}
