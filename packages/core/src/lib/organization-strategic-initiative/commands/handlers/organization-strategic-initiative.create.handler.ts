import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationStrategicInitiative } from '@gauzy/contracts';
import { OrganizationStrategicInitiativeCreateCommand } from '../organization-strategic-initiative.create.command';
import { OrganizationStrategicInitiativeService } from '../../organization-strategic-initiative.service';

@CommandHandler(OrganizationStrategicInitiativeCreateCommand)
export class OrganizationStrategicInitiativeCreateHandler
	implements ICommandHandler<OrganizationStrategicInitiativeCreateCommand>
{
	constructor(private readonly _organizationStrategicInitiativeService: OrganizationStrategicInitiativeService) {}

	/**
	 * Executes the create command for an organization strategic initiative.
	 *
	 * @param command - The create command containing the input data.
	 * @returns The created organization strategic initiative.
	 */
	public async execute(command: OrganizationStrategicInitiativeCreateCommand): Promise<IOrganizationStrategicInitiative> {
		const { input } = command;
		return await this._organizationStrategicInitiativeService.create(input);
	}
}
