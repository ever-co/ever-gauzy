import { ICommand } from '@nestjs/cqrs';
import { ITenant } from '@gauzy/contracts';

export class TenantRoleBulkCreateCommand implements ICommand {
	static readonly type = '[Role] Bulk Create';

	/**
	 * @param input - The tenants to give the default roles and their permissions.
	 * @param options.onlyMissing - Add only the roles and the (role, permission) rows a tenant does not hold yet,
	 * leaving every existing row and its `enabled` flag as it is: for a tenant an earlier, failed onboarding
	 * created, which may hold some of them (migrations also add permission rows to every tenant).
	 */
	constructor(
		public readonly input: ITenant[],
		public readonly options: { onlyMissing?: boolean } = {}
	) {}
}
