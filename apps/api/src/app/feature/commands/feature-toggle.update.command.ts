import { ICommand } from '@nestjs/cqrs';
import { IFeatureOrganizationUpdateInput } from '@gauzy/models';

export class FeatureToggleUpdateCommand implements ICommand {
	static readonly type = '[Feature] Toggle Update';

	constructor(public readonly input: IFeatureOrganizationUpdateInput) {}
}
