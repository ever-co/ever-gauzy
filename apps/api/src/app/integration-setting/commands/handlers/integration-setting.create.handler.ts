import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { IntegrationSettingCreateCommand } from '..';
import { IntegrationSettingService } from '../../integration-setting.service';
import { IIntegrationSetting } from '@gauzy/models';

@CommandHandler(IntegrationSettingCreateCommand)
export class IntegrationSettingCreateHandler
	implements ICommandHandler<IntegrationSettingCreateCommand> {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly integrationSettingService: IntegrationSettingService
	) {}

	public async execute(
		command: IntegrationSettingCreateCommand
	): Promise<IIntegrationSetting> {
		const { input } = command;

		return await this.integrationSettingService.create(input);
	}
}
