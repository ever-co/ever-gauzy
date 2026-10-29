import { ICommand } from '@nestjs/cqrs';
import { ITenant } from '@gauzy/contracts';

export class TenantFeatureOrganizationCreateCommand implements ICommand {
	static readonly type = '[Tenant] Feature Organization Create';

	/**
	 * @param input - The tenants to give their tenant-wide feature toggles.
	 * @param options.onlyMissing - Create only the toggles a tenant does not have yet (see
	 * `FeatureOrganizationService.updateTenantFeatureOrganizations`).
	 */
	constructor(
		public readonly input: ITenant[],
		public readonly options: { onlyMissing?: boolean } = {}
	) {}
}
