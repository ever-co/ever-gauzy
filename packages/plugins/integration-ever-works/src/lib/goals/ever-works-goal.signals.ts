import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subject, Subscription } from 'rxjs';
import { DataSource, EventSubscriber } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { BaseEntityEventSubscriber, Goal, KeyResult, KeyResultUpdate, RequestContext } from '@gauzy/core';
import { EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import { EverWorksOutboundQueue } from '../sync/outbound/ever-works-outbound.queue';
import { runDetached } from '../sync/outbound/ever-works-detached';

/**
 * A Gauzy goal or key result changed. The row as the ORM handed it to the subscriber: a partial update
 * saves only the fields sent (no organization, maybe no goal), so the capture reads what is missing.
 */
export interface EverWorksGoalSignal {
	/** `goal`: the goal itself; `keyResult`: its criteria / Definition of Done and its value; `keyResultUpdate`: a new value. */
	kind: 'goal' | 'keyResult' | 'keyResultUpdate';
	id: ID;
	tenantId: ID | null;
	organizationId: ID | null;
	/** A key result's goal, when the row carried it. */
	goalId: ID | null;
	deleted: boolean;
	actorUserId: ID | null;
}

/**
 * Outbound trigger 2 (plan 03 §C.2) for goals: `Goal`, `KeyResult` and `KeyResultUpdate` subscribers.
 * They are created by the ORM, outside Nest, so they signal through this static subject, which
 * {@link EverWorksGoalCapture} drains into the queue.
 */
export const EVER_WORKS_GOAL_SIGNALS = new Subject<EverWorksGoalSignal>();

function signal(
	kind: EverWorksGoalSignal['kind'],
	row: { tenantId?: ID; organizationId?: ID; goalId?: string | null } | undefined,
	id: ID | undefined,
	deleted = false
): void {
	// Loop guard level 1: what the inbound applier writes is never captured.
	if (EverWorksSyncContext.isApplying()) return;
	if (!id) return;
	let actorUserId: ID | null = null;
	try {
		actorUserId = (RequestContext.currentUserId() as ID) ?? null;
	} catch {
		actorUserId = null;
	}
	EVER_WORKS_GOAL_SIGNALS.next({
		kind,
		id,
		tenantId: row?.tenantId ?? null,
		organizationId: row?.organizationId ?? null,
		goalId: (row?.goalId as ID) ?? null,
		deleted,
		actorUserId
	});
}

/** `Goal` created, edited, archived or deleted. */
@EventSubscriber()
export class EverWorksGoalSubscriber extends BaseEntityEventSubscriber<Goal> {
	override listenTo() {
		return Goal;
	}

	override async afterEntityCreate(entity: Goal): Promise<void> {
		signal('goal', entity, entity?.id as ID);
	}

	override async afterEntityUpdate(entity: Goal): Promise<void> {
		signal('goal', entity, entity?.id as ID);
	}

	override async afterEntitySoftRemove(entity: Goal): Promise<void> {
		signal('goal', entity, entity?.id as ID, true);
	}

	override async afterEntityDelete(entity: Goal): Promise<void> {
		signal('goal', entity, entity?.id as ID, true);
	}
}

/** A key result added, edited or removed: its goal's criteria / Definition of Done, and its value. */
@EventSubscriber()
export class EverWorksKeyResultSubscriber extends BaseEntityEventSubscriber<KeyResult> {
	override listenTo() {
		return KeyResult;
	}

	override async afterEntityCreate(entity: KeyResult): Promise<void> {
		signal('keyResult', entity, entity?.id as ID);
	}

	override async afterEntityUpdate(entity: KeyResult): Promise<void> {
		signal('keyResult', entity, entity?.id as ID);
	}

	override async afterEntityDelete(entity: KeyResult): Promise<void> {
		signal('keyResult', entity, entity?.id as ID, true);
	}
}

/** A key result update (a new value): pushed as an Ever Works sample. */
@EventSubscriber()
export class EverWorksKeyResultUpdateSubscriber extends BaseEntityEventSubscriber<KeyResultUpdate> {
	override listenTo() {
		return KeyResultUpdate;
	}

	override async afterEntityCreate(entity: KeyResultUpdate): Promise<void> {
		signal('keyResultUpdate', entity, entity?.keyResultId as ID);
	}
}

/**
 * Drains the goal signals into the outbound queue: a goal → `GOAL`; a key result → its goal's `GOAL`
 * (criteria, Definition of Done) and its own `KEY_RESULT` (value); a key result update → `KEY_RESULT`.
 * What a partial row lacks (tenant, organization, the key result's goal) is read from the saved row.
 */
@Injectable()
export class EverWorksGoalCapture implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('EverWorksGoals');
	private subscription: Subscription | null = null;

	constructor(
		private readonly queue: EverWorksOutboundQueue,
		private readonly dataSource: DataSource
	) {}

	onModuleInit(): void {
		this.subscription = EVER_WORKS_GOAL_SIGNALS.subscribe((change) => {
			// Outside the goal write's transaction context (see ever-works-detached.ts).
			void runDetached(() => this.capture(change)).catch((error) =>
				this.logger.warn(
					`A goal change could not be queued (${error instanceof Error ? error.name : 'error'}).`
				)
			);
		});
	}

	onModuleDestroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
	}

	private async capture(change: EverWorksGoalSignal): Promise<void> {
		const op = change.deleted ? 'delete' : 'upsert';
		const enqueue = (
			entityType: EverWorksLinkType.GOAL | EverWorksLinkType.KEY_RESULT,
			gauzyId: ID,
			scope: { tenantId: ID; organizationId: ID },
			upsert = false
		) =>
			this.queue.enqueue({
				...scope,
				entityType,
				gauzyId,
				op: upsert ? 'upsert' : op,
				actorUserId: change.actorUserId
			});
		if (change.kind === 'goal') {
			const scope = await this.scopeOf(Goal, change.id, change);
			if (scope) await enqueue(EverWorksLinkType.GOAL, change.id, scope);
			return;
		}
		const row = (await this.dataSource
			.getRepository(KeyResult)
			.findOne({ where: { id: change.id } as never, withDeleted: true })) as KeyResult | null;
		const tenantId = change.tenantId ?? (row?.tenantId as ID | undefined) ?? null;
		const organizationId = change.organizationId ?? (row?.organizationId as ID | undefined) ?? null;
		if (!tenantId || !organizationId) return;
		const scope = { tenantId, organizationId };
		if (change.kind === 'keyResult') {
			// The goal's push recomputes its criteria and Definition of Done (a removed key result leaves).
			const goalId = change.goalId ?? (row?.goalId as ID | undefined) ?? null;
			if (goalId) await enqueue(EverWorksLinkType.GOAL, goalId, scope, true);
			if (!change.deleted) await enqueue(EverWorksLinkType.KEY_RESULT, change.id, scope);
			return;
		}
		await enqueue(EverWorksLinkType.KEY_RESULT, change.id, scope);
	}

	/** The tenant and organization of a row: as the signal carried them, else from the saved row. */
	private async scopeOf(
		entity: typeof Goal,
		id: ID,
		change: EverWorksGoalSignal
	): Promise<{ tenantId: ID; organizationId: ID } | null> {
		if (change.tenantId && change.organizationId)
			return { tenantId: change.tenantId, organizationId: change.organizationId };
		const row = (await this.dataSource
			.getRepository(entity)
			.findOne({ where: { id } as never, withDeleted: true })) as {
			tenantId?: ID;
			organizationId?: ID;
		} | null;
		const tenantId = change.tenantId ?? row?.tenantId ?? null;
		const organizationId = change.organizationId ?? row?.organizationId ?? null;
		return tenantId && organizationId ? { tenantId, organizationId } : null;
	}
}
