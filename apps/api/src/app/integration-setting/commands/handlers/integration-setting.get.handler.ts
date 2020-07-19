import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IntegrationSettingGetCommand } from '..';
import { IntegrationSettingService } from '../../integration-setting.service';
import { IntegrationSetting } from '../../integration-setting.entity';

@CommandHandler(IntegrationSettingGetCommand)
export class IntegrationSettingGetHandler
	implements ICommandHandler<IntegrationSettingGetCommand> {
	constructor(
		private readonly integrationSettingService: IntegrationSettingService
	) {}

	public async execute(
		command: IntegrationSettingGetCommand
	): Promise<IntegrationSetting> {
		const { input } = command;

		const { record } = await this.integrationSettingService.findOneOrFail(
			input
		);
		return record;
	}
}
