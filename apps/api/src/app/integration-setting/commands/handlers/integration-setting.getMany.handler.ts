import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IntegrationSettingGetManyCommand } from '..';
import { IntegrationSettingService } from '../../integration-setting.service';
import { IIntegrationSetting } from '@gauzy/models';

@CommandHandler(IntegrationSettingGetManyCommand)
export class IntegrationSettingGetManyHandler
	implements ICommandHandler<IntegrationSettingGetManyCommand> {
	constructor(private readonly isService: IntegrationSettingService) {}

	public async execute(
		command: IntegrationSettingGetManyCommand
	): Promise<IIntegrationSetting[]> {
		const { input } = command;

		const { items } = await this.isService.findAll(input);
		return items;
	}
}
