import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subject, Subscription } from 'rxjs';
import { EventSubscriber } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { BaseEntityEventSubscriber, OrganizationTeam, OrganizationTeamEmployee, RequestContext } from '@gauzy/core';
import { EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import { EverWorksOutboundQueue } from '../sync/outbound/ever-works-outbound.queue';
import { runDetached } from '../sync/outbound/ever-works-detached';

/** A Gauzy team (or one of its memberships) changed. */
export interface EverWorksTeamSignal {
	tenantId: ID;
	organizationId: ID;
	teamId: ID;
	deleted: boolean;
	actorUserId: ID | null;
}

/**
 * Outbound trigger 2 (plan 03 §C.2) for teams. Entity subscribers are created by the ORM, outside Nest,
 * so they signal through this static subject, which {@link EverWorksTeamCapture} drains into the queue.
 */
export const EVER_WORKS_TEAM_SIGNALS = new Subject<EverWorksTeamSignal>();

function signal(row: { tenantId?: ID; organizationId?: ID } | undefined, teamId: ID | undefined, deleted: boolean): void {
	// Loop guard level 1: what the inbound applier writes is never captured.
	if (EverWorksSyncContext.isApplying()) return;
	if (!row?.tenantId || !row.organizationId || !teamId) return;
	let actorUserId: ID | null = null;
	try {
		actorUserId = (RequestContext.currentUserId() as ID) ?? null;
	} catch {
		actorUserId = null;
	}
	EVER_WORKS_TEAM_SIGNALS.next({ tenantId: row.tenantId, organizationId: row.organizationId, teamId, deleted, actorUserId });
}

/** `OrganizationTeam` created, renamed, archived or deleted. */
@EventSubscriber()
export class EverWorksTeamSubscriber extends BaseEntityEventSubscriber<OrganizationTeam> {
	override listenTo() {
		return OrganizationTeam;
	}

	override async afterEntityCreate(entity: OrganizationTeam): Promise<void> {
		signal(entity, entity?.id as ID, false);
	}

	override async afterEntityUpdate(entity: OrganizationTeam): Promise<void> {
		signal(entity, entity?.id as ID, false);
	}

	override async afterEntitySoftRemove(entity: OrganizationTeam): Promise<void> {
		signal(entity, entity?.id as ID, true);
	}

	override async afterEntityDelete(entity: OrganizationTeam): Promise<void> {
		signal(entity, entity?.id as ID, true);
	}
}

/** A membership of a team added, changed (manager) or removed: the team's member set changed. */
@EventSubscriber()
export class EverWorksTeamMemberSubscriber extends BaseEntityEventSubscriber<OrganizationTeamEmployee> {
	override listenTo() {
		return OrganizationTeamEmployee;
	}

	override async afterEntityCreate(entity: OrganizationTeamEmployee): Promise<void> {
		signal(entity, entity?.organizationTeamId as ID, false);
	}

	override async afterEntityUpdate(entity: OrganizationTeamEmployee): Promise<void> {
		signal(entity, entity?.organizationTeamId as ID, false);
	}

	override async afterEntityDelete(entity: OrganizationTeamEmployee): Promise<void> {
		signal(entity, entity?.organizationTeamId as ID, false);
	}
}

/** Drains the team signals into the outbound queue (one coalesced TEAM change per team). */
@Injectable()
export class EverWorksTeamCapture implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('EverWorksTeams');
	private subscription: Subscription | null = null;

	constructor(private readonly queue: EverWorksOutboundQueue) {}

	onModuleInit(): void {
		this.subscription = EVER_WORKS_TEAM_SIGNALS.subscribe((change) => {
			// Outside the team write's transaction context (see ever-works-detached.ts).
			void runDetached(() =>
				this.queue.enqueue({
					tenantId: change.tenantId,
					organizationId: change.organizationId,
					entityType: EverWorksLinkType.TEAM,
					gauzyId: change.teamId,
					op: change.deleted ? 'delete' : 'upsert',
					actorUserId: change.actorUserId
				})
			).catch((error) => this.logger.warn(`A team change could not be queued (${error instanceof Error ? error.name : 'error'}).`));
		});
	}

	onModuleDestroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
	}
}
