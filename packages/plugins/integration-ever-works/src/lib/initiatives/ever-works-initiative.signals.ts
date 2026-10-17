import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subject, Subscription } from 'rxjs';
import { DataSource, EventSubscriber } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { BaseEntityEventSubscriber, Goal, OrganizationStrategicInitiative, RequestContext } from '@gauzy/core';
import { EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import { EverWorksOutboundQueue } from '../sync/outbound/ever-works-outbound.queue';

/**
 * A Gauzy strategic initiative changed, or a goal moved onto it. The row as the ORM handed it to the
 * subscriber: a partial update saves only the fields sent (maybe no tenant or organization), so the
 * capture reads what is missing from the saved row.
 */
export interface EverWorksInitiativeSignal {
	tenantId: ID | null;
	organizationId: ID | null;
	initiativeId: ID;
	deleted: boolean;
	actorUserId: ID | null;
}

/**
 * Outbound trigger 2 (plan 03 §C.2) for initiatives. The subscriber is created by the ORM, outside Nest,
 * so it signals through this static subject, which {@link EverWorksInitiativeCapture} drains.
 */
export const EVER_WORKS_INITIATIVE_SIGNALS = new Subject<EverWorksInitiativeSignal>();

function signal(
	row: { tenantId?: ID; organizationId?: ID } | undefined,
	initiativeId: ID | null | undefined,
	deleted: boolean
): void {
	// Loop guard level 1: what the inbound applier writes is never captured.
	if (EverWorksSyncContext.isApplying()) return;
	if (!initiativeId) return;
	let actorUserId: ID | null = null;
	try {
		actorUserId = (RequestContext.currentUserId() as ID) ?? null;
	} catch {
		actorUserId = null;
	}
	EVER_WORKS_INITIATIVE_SIGNALS.next({
		tenantId: (row?.tenantId as ID) ?? null,
		organizationId: (row?.organizationId as ID) ?? null,
		initiativeId,
		deleted,
		actorUserId
	});
}

/** `OrganizationStrategicInitiative` created, edited, archived or deleted. */
@EventSubscriber()
export class EverWorksInitiativeSubscriber extends BaseEntityEventSubscriber<OrganizationStrategicInitiative> {
	override listenTo() {
		return OrganizationStrategicInitiative;
	}

	override async afterEntityCreate(entity: OrganizationStrategicInitiative): Promise<void> {
		signal(entity, entity?.id as ID, false);
	}

	override async afterEntityUpdate(entity: OrganizationStrategicInitiative): Promise<void> {
		signal(entity, entity?.id as ID, false);
	}

	override async afterEntitySoftRemove(entity: OrganizationStrategicInitiative): Promise<void> {
		signal(entity, entity?.id as ID, true);
	}

	override async afterEntityDelete(entity: OrganizationStrategicInitiative): Promise<void> {
		signal(entity, entity?.id as ID, true);
	}
}

/**
 * A goal saved with an initiative: that initiative's mission gets the goal (the initiative it left, if
 * any, is found by the initiative sweep, which compares the goals Gauzy shows on each paired initiative).
 */
@EventSubscriber()
export class EverWorksInitiativeGoalSubscriber extends BaseEntityEventSubscriber<Goal> {
	override listenTo() {
		return Goal;
	}

	override async afterEntityCreate(entity: Goal): Promise<void> {
		signal(entity, entity?.organizationStrategicInitiativeId as ID, false);
	}

	override async afterEntityUpdate(entity: Goal): Promise<void> {
		signal(entity, entity?.organizationStrategicInitiativeId as ID, false);
	}
}

/**
 * Drains the initiative signals into the outbound queue (one coalesced change per initiative). What a
 * partial row lacks (tenant, organization) is read from the saved initiative.
 */
@Injectable()
export class EverWorksInitiativeCapture implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('EverWorksInitiatives');
	private subscription: Subscription | null = null;

	constructor(
		private readonly queue: EverWorksOutboundQueue,
		private readonly dataSource: DataSource
	) {}

	onModuleInit(): void {
		this.subscription = EVER_WORKS_INITIATIVE_SIGNALS.subscribe((change) => {
			void this.capture(change).catch((error) =>
				this.logger.warn(
					`An initiative change could not be queued (${error instanceof Error ? error.name : 'error'}).`
				)
			);
		});
	}

	private async capture(change: EverWorksInitiativeSignal): Promise<void> {
		let { tenantId, organizationId } = change;
		if (!tenantId || !organizationId) {
			const row = (await this.dataSource.getRepository(OrganizationStrategicInitiative).findOne({
				where: { id: change.initiativeId } as never,
				withDeleted: true
			})) as { tenantId?: ID; organizationId?: ID } | null;
			tenantId = tenantId ?? row?.tenantId ?? null;
			organizationId = organizationId ?? row?.organizationId ?? null;
		}
		if (!tenantId || !organizationId) return;
		await this.queue.enqueue({
			tenantId,
			organizationId,
			entityType: EverWorksLinkType.INITIATIVE_MISSION,
			gauzyId: change.initiativeId,
			op: change.deleted ? 'delete' : 'upsert',
			actorUserId: change.actorUserId
		});
	}

	onModuleDestroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
	}
}
