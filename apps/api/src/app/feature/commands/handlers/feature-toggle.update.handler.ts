import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FeatureService } from '../../feature.service';
import { FeatureToggleUpdateCommand } from '../feature-toggle.update.command';

@CommandHandler(FeatureToggleUpdateCommand)
export class FeatureToggleUpdateHandler
	implements ICommandHandler<FeatureToggleUpdateCommand> {
	constructor(private readonly featureService: FeatureService) {}

	public async execute(command: FeatureToggleUpdateCommand): Promise<any> {
		const { input } = command;
		return this.featureService.updateFeatureOrganization(input);
	}
}
