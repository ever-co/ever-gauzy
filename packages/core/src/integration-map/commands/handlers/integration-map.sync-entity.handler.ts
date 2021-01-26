import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IntegrationMapSyncEntityCommand } from '..';
import { IntegrationMapService } from '../../integration-map.service';
import { IntegrationMap } from '../../integration-map.entity';

@CommandHandler(IntegrationMapSyncEntityCommand)
export class IntegrationMapSyncEntityHandler
	implements ICommandHandler<IntegrationMapSyncEntityCommand> {
	constructor(private _ims: IntegrationMapService) {}

	public async execute(
		command: IntegrationMapSyncEntityCommand
	): Promise<IntegrationMap> {
		const { input } = command;

		return await this._ims.create(input);
	}
}
