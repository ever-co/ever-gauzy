import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationStrategicInitiative } from '@gauzy/contracts';
import { OrganizationStrategicInitiativeUpdateSignalsCommand } from '../organization-strategic-initiative.update-signals.command';
import { OrganizationStrategicInitiativeService } from '../../organization-strategic-initiative.service';

@CommandHandler(OrganizationStrategicInitiativeUpdateSignalsCommand)
export class OrganizationStrategicInitiativeUpdateSignalsHandler
	implements ICommandHandler<OrganizationStrategicInitiativeUpdateSignalsCommand>
{
	constructor(private readonly _organizationStrategicInitiativeService: OrganizationStrategicInitiativeService) {}

	/**
	 * Executes the update signals command for an organization strategic initiative.
	 *
	 * @param command - The command containing the ID and signals data.
	 * @returns The updated organization strategic initiative.
	 */
	public async execute(
		command: OrganizationStrategicInitiativeUpdateSignalsCommand
	): Promise<IOrganizationStrategicInitiative> {
		const { id, signals } = command;
		return await this._organizationStrategicInitiativeService.updateSignals(id, signals);
	}
}
