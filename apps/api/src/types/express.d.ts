import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    /** Initialized by requestId middleware before all application handlers. */
    requestId: string;
  }
}
