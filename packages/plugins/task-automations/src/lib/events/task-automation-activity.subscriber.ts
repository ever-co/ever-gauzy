import { EventSubscriber } from 'typeorm';
import { ActorTypeEnum, BaseEntityEnum } from '@gauzy/contracts';
import { ActivityLog, BaseEntityEventSubscriber } from '@gauzy/core';
import { ITaskAutomationActorMarker } from '../engine/loop-guard';
import { currentAutomationMarker } from '../services/task-automation-context';

/** The description of an activity row a rule's change wrote: the platform's own, then the rule (spec FR-8). */
export function attributedDescription(description: string | null | undefined, marker: Pick<ITaskAutomationActorMarker, 'ruleName'>): string {
	const suffix = `by automation "${marker.ruleName}"`;
	const base = String(description ?? '').trim();
	if (base.endsWith(suffix)) return base;
	return base ? `${base} ${suffix}` : suffix;
}

/**
 * Attributes to the rule the activity rows its changes write (spec FR-8): a row created while a rule's system actor
 * is signed in — the task update the rule ran logged it — gets the system as its actor and "by automation <name>" in
 * its description. Rows written by people are left as they are. Registered on both ORMs with the plugin.
 */
@EventSubscriber()
export class TaskAutomationActivitySubscriber extends BaseEntityEventSubscriber<ActivityLog> {
	override listenTo() {
		return ActivityLog;
	}

	override async beforeEntityCreate(entity: ActivityLog): Promise<void> {
		attributeActivity(entity, currentAutomationMarker());
	}
}

/** The attribution itself (also what the subscriber's spec drives). */
export function attributeActivity(
	entity: Pick<ActivityLog, 'entity' | 'actorType' | 'description'> | null | undefined,
	marker: ITaskAutomationActorMarker | null
): void {
	if (!entity || !marker || entity.entity !== BaseEntityEnum.Task) return;
	entity.actorType = ActorTypeEnum.System;
	entity.description = attributedDescription(entity.description, marker);
}
