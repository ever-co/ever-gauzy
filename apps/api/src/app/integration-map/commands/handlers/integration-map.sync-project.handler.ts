import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { IntegrationMapSyncProjectCommand } from '..';
import { IntegrationEntity } from '@gauzy/models';
import { IntegrationMapService } from '../../integration-map.service';
import { OrganizationProjectCreateCommand } from '../../../organization-projects/commands/organization-project.create.command';
import { IntegrationMap } from '../../integration-map.entity';

@CommandHandler(IntegrationMapSyncProjectCommand)
export class IntegrationMapSyncProjectHandler
	implements ICommandHandler<IntegrationMapSyncProjectCommand> {
	constructor(private _cb: CommandBus, private _ims: IntegrationMapService) {}

	public async execute(
		command: IntegrationMapSyncProjectCommand
	): Promise<IntegrationMap> {
		const { input } = command;
		const {
			organizationProjectCreateInput,
			integrationId,
			sourceId,
		} = input;

		const project = await this._cb.execute(
			new OrganizationProjectCreateCommand(organizationProjectCreateInput)
		);

		return await this._ims.create({
			gauzyId: project.id,
			integrationId,
			sourceId,
			entity: IntegrationEntity.PROJECT,
		});
	}
}
