/**
 * Type declarations for csrf-csrf library compatibility
 * Resolves conflicts with express-serve-static-core types
 */

import type { CsrfTokenGeneratorRequestUtil } from 'csrf-csrf';

declare global {
  namespace Express {
    interface Request {
      csrfToken?: string | CsrfTokenGeneratorRequestUtil;
    }
  }
}

// Override the conflicting type definition
declare module 'express-serve-static-core' {
  interface Request {
    csrfToken?: string | CsrfTokenGeneratorRequestUtil;
  }
}

export {};
