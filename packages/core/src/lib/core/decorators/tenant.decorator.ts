import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { ITenant } from '@gauzy/contracts';
import { RequestContext } from '../context';

/**
 * Current request tenant decorator
 *
 * Extracts the tenant from the current request context
 *
 * @example
 * ```typescript
 * @Get()
 * async findAll(@TenantDecorator() tenant: ITenant) {
 *   // tenant contains the current tenant object
 * }
 * ```
 */
export const TenantDecorator = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): ITenant => {
    const request = ctx.switchToHttp().getRequest<Request>();

    // Return tenant from request if explicitly set by middleware/guard
    if (request.tenant) {
      return request.tenant;
    }

    // Otherwise, get current tenant from request context
    const tenantId = RequestContext.currentTenantId();
    if (!tenantId) {
      return null;
    }

    return {
      id: tenantId,
      name: request.get('Tenant-Name') || 'Default',
      // Additional tenant properties can be populated here if needed
    };
  },
);

declare global {
  namespace Express {
    interface Request {
      tenant?: ITenant;
    }
  }
}
