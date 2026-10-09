import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { RequestContext } from '@gauzy/core';

/**
 * Refuses a GitHub integration request whose loaded integration belongs to another tenant
 * (GHSA-4rwq-65wh-45h4).
 *
 * `GithubMiddleware` resolves the integration's settings — including the GitHub App `installation_id`
 * the handlers then act with — before authentication, choosing the tenant from `?tenantId=` ahead of
 * the `Tenant-Id` header. The tenant guard validates only the header when one is present, so a caller
 * could send their own tenant in the header and a victim's in the query, and the handler would list,
 * read or sync the victim's repositories. This guard runs after authentication and compares the
 * integration's OWNER with the authenticated tenant.
 *
 * Routes the middleware does not serve have no `request.integration` and pass through untouched.
 */
@Injectable()
export class GithubIntegrationTenantGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest();
		const integration = request?.['integration'];
		if (!integration) {
			return true;
		}
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId || !integration.tenantId || String(integration.tenantId) !== String(tenantId)) {
			throw new ForbiddenException('This GitHub integration does not belong to your tenant.');
		}
		return true;
	}
}
