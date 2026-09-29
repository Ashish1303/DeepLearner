import type { Request, Response } from 'express';
import { successResponse } from '../../common/http/response.js';
import type { RegistrationInput } from './auth.schema.js';
import type { RegistrationService } from './registration.service.js';

export function createAuthController(service: RegistrationService) {
  return {
    async register(req: Request, res: Response, input: RegistrationInput) {
      const result = await service.register(input, req.requestId);
      const message =
        result.verificationEmailStatus === 'ACCEPTED'
          ? 'Account created. Verify your email before signing in.'
          : 'Account created. Verification email delivery could not be confirmed. Please request another verification email.';
      res.status(201).json(successResponse(result, req.requestId, message));
    },
    async verify(req: Request, res: Response, token: string) {
      res.json(
        successResponse(
          await service.verify(token, req.requestId),
          req.requestId,
          'Email verified successfully',
        ),
      );
    },
    async resend(req: Request, res: Response, email: string) {
      await service.resend(email, req.requestId);
      res
        .status(202)
        .json(
          successResponse(
            null,
            req.requestId,
            'Request received. If your account needs verification, check your inbox or try again later.',
          ),
        );
    },
  };
}
