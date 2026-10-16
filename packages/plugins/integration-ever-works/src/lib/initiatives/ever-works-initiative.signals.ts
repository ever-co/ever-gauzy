import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subject, Subscription } from 'rxjs';
import { EventSubscriber } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { BaseEntityEventSubscriber, OrganizationStrategicInitiative, RequestContext } from '@gauzy/core';
import { EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import { EverWorksOutboundQueue } from '../sync/outbound/ever-works-outbound.queue';

/** A Gauzy strategic initiative changed. */
export interface EverWorksInitiativeSignal {
	tenantId: ID;
	organizationId: ID;
	initiativeId: ID;
	deleted: boolean;
	actorUserId: ID | null;
}

/**
 * Outbound trigger 2 (plan 03 §C.2) for initiatives. The subscriber is created by the ORM, outside Nest,
 * so it signals through this static subject, which {@link EverWorksInitiativeCapture} drains.
 */
export const EVER_WORKS_INITIATIVE_SIGNALS = new Subject<EverWorksInitiativeSignal>();

function signal(row: OrganizationStrategicInitiative | undefined, deleted: boolean): void {
	// Loop guard level 1: what the inbound applier writes is never captured.
	if (EverWorksSyncContext.isApplying()) return;
	if (!row?.tenantId || !row.organizationId || !row.id) return;
	let actorUserId: ID | null = null;
	try {
		actorUserId = (RequestContext.currentUserId() as ID) ?? null;
	} catch {
		actorUserId = null;
	}
	EVER_WORKS_INITIATIVE_SIGNALS.next({
		tenantId: row.tenantId as ID,
		organizationId: row.organizationId as ID,
		initiativeId: row.id as ID,
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
		signal(entity, false);
	}

	override async afterEntityUpdate(entity: OrganizationStrategicInitiative): Promise<void> {
		signal(entity, false);
	}

	override async afterEntitySoftRemove(entity: OrganizationStrategicInitiative): Promise<void> {
		signal(entity, true);
	}

	override async afterEntityDelete(entity: OrganizationStrategicInitiative): Promise<void> {
		signal(entity, true);
	}
}

/** Drains the initiative signals into the outbound queue (one coalesced change per initiative). */
@Injectable()
export class EverWorksInitiativeCapture implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('EverWorksInitiatives');
	private subscription: Subscription | null = null;

	constructor(private readonly queue: EverWorksOutboundQueue) {}

	onModuleInit(): void {
		this.subscription = EVER_WORKS_INITIATIVE_SIGNALS.subscribe((change) => {
			void this.queue
				.enqueue({
					tenantId: change.tenantId,
					organizationId: change.organizationId,
					entityType: EverWorksLinkType.INITIATIVE_MISSION,
					gauzyId: change.initiativeId,
					op: change.deleted ? 'delete' : 'upsert',
					actorUserId: change.actorUserId
				})
				.catch((error) =>
					this.logger.warn(
						`An initiative change could not be queued (${error instanceof Error ? error.name : 'error'}).`
					)
				);
		});
	}

	onModuleDestroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
	}
}
