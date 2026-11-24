import { IEvent } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';

export interface ITrackingTurnedOffScope {
	employeeId: ID;
	organizationId: ID;
	tenantId: ID;
	/** Set when tracking was turned off for this team only; the employee's other teams keep their timer. */
	organizationTeamId?: ID;
}

/**
 * An employee's time tracking was turned off, for the whole organization or for one team; their membership of a team
 * ending turns it off for that team. The timer they still run there stops.
 */
export class TrackingTurnedOffEvent implements IEvent {
	constructor(public readonly scope: ITrackingTurnedOffScope) {}
}
