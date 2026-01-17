import { ICommand } from '@nestjs/cqrs';
import { IOrganizationStrategicInitiativeCreateInput } from '@gauzy/contracts';

/**
 * Command to create a new organization strategic initiative.
 */
export class OrganizationStrategicInitiativeCreateCommand implements ICommand {
	static readonly type = '[OrganizationStrategicInitiative] Create';

	constructor(public readonly input: IOrganizationStrategicInitiativeCreateInput) {}
}
