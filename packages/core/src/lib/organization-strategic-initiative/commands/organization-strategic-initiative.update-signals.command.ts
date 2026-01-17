import { ICommand } from '@nestjs/cqrs';
import { ID, IOrganizationStrategicSignals } from '@gauzy/contracts';

/**
 * Command to update strategic signals of an initiative.
 */
export class OrganizationStrategicInitiativeUpdateSignalsCommand implements ICommand {
	static readonly type = '[OrganizationStrategicInitiative] Update Signals';

	constructor(
		public readonly id: ID,
		public readonly signals: IOrganizationStrategicSignals
	) {}
}
