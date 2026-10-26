import { ID } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';

/**
 * The tenant and organization scope a read is constrained to.
 *
 * Every read in this package is scoped, so one tenant can never see another's rows. The scope is
 * built as an object with the members that actually exist rather than as a pair of possibly-undefined
 * values, because a `where` member whose value is `undefined` is not "no condition" to the ORM — it
 * is a refused query. That distinction matters for the one caller that has no request at all: the
 * billing run, which executes on a schedule and therefore has no tenant in context. It reads across
 * tenants deliberately, one subscription at a time, and writes each row with the tenant it read.
 *
 * @returns The scope, carrying only the identifiers that are known.
 */
export function currentScope(): { tenantId?: ID; organizationId?: ID } {
	const tenantId = RequestContext.currentTenantId();
	const organizationId = RequestContext.currentOrganizationId();

	return {
		...(tenantId ? { tenantId } : {}),
		...(organizationId ? { organizationId } : {})
	};
}
