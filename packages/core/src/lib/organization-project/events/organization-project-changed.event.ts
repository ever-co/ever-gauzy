import { IEvent } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';
import { IProjectChange } from '../project-notifications';

/**
 * A project's state, dates or archiving changed (see `projectChangesOf`): its followers, its members, are told, when
 * follower notifications are on (`FollowerFanOutService`).
 */
export class OrganizationProjectChangedEvent implements IEvent {
	constructor(
		public readonly project: { id: ID; name?: string | null; organizationId: ID; tenantId: ID },
		public readonly changes: ReadonlyArray<IProjectChange>
	) {}
}
