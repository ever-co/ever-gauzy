import { Logger } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { ActionTypeEnum, ActorTypeEnum, AgentExitLogoutField, BaseEntityEnum, ID } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { ActivityLogEvent } from './events/activity-log.event';

const logger = new Logger('AgentRestrictionAcknowledgement');

/**
 * Records, against the acting admin, that they explicitly accepted the legal risk of stopping a
 * monitored worker from exiting or logging out of the desktop agent (issue #9873).
 *
 * Stored as an activity log entry on the organization / employee so the acknowledgement survives
 * log rotation and can be reviewed per entity. The admin's ID is written into `data` as well as
 * `createdByUserId`, because the latter is filled from the request context, which an
 * asynchronously handled event cannot be relied on to carry.
 */
export function recordAgentRestrictionAcknowledgement(
	eventBus: EventBus,
	params: {
		entity: BaseEntityEnum.Organization | BaseEntityEnum.Employee;
		entityId: ID;
		entityName: string;
		organizationId: ID;
		tenantId: ID;
		restricted: AgentExitLogoutField[];
	}
): void {
	const { entity, entityId, entityName, organizationId, tenantId, restricted } = params;
	const acknowledgedByUserId = RequestContext.currentUserId();
	const acknowledgedAt = new Date().toISOString();

	logger.log(
		`[AGENT_RESTRICTION_ACKNOWLEDGEMENT] User ${acknowledgedByUserId} acknowledged restricting ${restricted.join(
			', '
		)} on ${entity} ${entityId} (tenant ${tenantId}) at ${acknowledgedAt}`
	);

	eventBus.publish(
		new ActivityLogEvent({
			entity,
			entityId,
			action: ActionTypeEnum.Updated,
			actorType: ActorTypeEnum.User,
			description: `${entityName}: exit/logout restriction acknowledged (${restricted.join(', ')})`,
			updatedFields: restricted,
			data: {
				agentExitLogoutRestrictionAcknowledgement: {
					acknowledgedByUserId,
					acknowledgedAt,
					restricted
				}
			},
			organizationId,
			tenantId
		})
	);
}
