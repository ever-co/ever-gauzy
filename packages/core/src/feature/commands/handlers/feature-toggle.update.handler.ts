import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FeatureOrganizationService } from 'feature/feature-organization.service';
import { FeatureToggleUpdateCommand } from '../feature-toggle.update.command';

@CommandHandler(FeatureToggleUpdateCommand)
export class FeatureToggleUpdateHandler
	implements ICommandHandler<FeatureToggleUpdateCommand> {
	constructor(
		private readonly _featureOrganizationService: FeatureOrganizationService
	) {}

	public async execute(command: FeatureToggleUpdateCommand): Promise<any> {
		const { input } = command;
		return this._featureOrganizationService.updateFeatureOrganization(input);
	}
}
