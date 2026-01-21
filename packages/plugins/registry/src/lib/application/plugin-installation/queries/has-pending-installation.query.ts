import { ID } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

/**
 * Query to check if the current user has at least one pending plugin installation
 */
export class HasPendingInstallationQuery implements IQuery {
	public static readonly type = '[Plugin] Has Pending Installation';

	constructor(public readonly userId: ID, public readonly tenantId: ID, public readonly organizationId?: ID) {}
}
