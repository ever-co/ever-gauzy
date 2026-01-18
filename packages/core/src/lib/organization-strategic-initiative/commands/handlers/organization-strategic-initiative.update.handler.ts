import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationStrategicInitiative } from '@gauzy/contracts';
import { UpdateResult } from 'typeorm';
import { OrganizationStrategicInitiativeUpdateCommand } from '../organization-strategic-initiative.update.command';
import { OrganizationStrategicInitiativeService } from '../../organization-strategic-initiative.service';

@CommandHandler(OrganizationStrategicInitiativeUpdateCommand)
export class OrganizationStrategicInitiativeUpdateHandler
	implements ICommandHandler<OrganizationStrategicInitiativeUpdateCommand>
{
	constructor(private readonly _organizationStrategicInitiativeService: OrganizationStrategicInitiativeService) {}

	/**
	 * Executes the update command for an organization strategic initiative.
	 *
	 * @param command - The update command containing the ID and input data.
	 * @returns The updated organization strategic initiative or update result.
	 */
	public async execute(
		command: OrganizationStrategicInitiativeUpdateCommand
	): Promise<IOrganizationStrategicInitiative | UpdateResult> {
		const { id, input } = command;
		return await this._organizationStrategicInitiativeService.update(id, input);
	}
}
