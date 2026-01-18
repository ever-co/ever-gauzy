import { ICommand } from '@nestjs/cqrs';
import { ID, IOrganizationStrategicInitiativeUpdateInput } from '@gauzy/contracts';

/**
 * Command to update an existing organization strategic initiative.
 */
export class OrganizationStrategicInitiativeUpdateCommand implements ICommand {
	static readonly type = '[OrganizationStrategicInitiative] Update';

	constructor(
		public readonly id: ID,
		public readonly input: IOrganizationStrategicInitiativeUpdateInput
	) {}
}
