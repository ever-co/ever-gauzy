import { IEvent } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export interface ITrackingTurnedOffScope {
	employeeId: ID;
	organizationId: ID;
	tenantId: ID;
	/** Set when tracking was turned off for this team only; the employee's other teams keep their timer. */
	organizationTeamId?: ID;
}

/** An employee's time tracking was turned off, for the whole organization or for one team. */
export class TrackingTurnedOffEvent implements IEvent {
	constructor(public readonly scope: ITrackingTurnedOffScope) {}
}
