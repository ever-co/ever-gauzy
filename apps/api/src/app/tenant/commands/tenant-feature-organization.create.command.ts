import { ICommand } from '@nestjs/cqrs';
import { ITenant } from '@gauzy/models';

export class TenantFeatureOrganizationCreateCommand implements ICommand {
	static readonly type = '[Tenant] Feature Organization Create';

	constructor(public readonly input: ITenant[]) {}
}
