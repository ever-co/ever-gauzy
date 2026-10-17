import { Injectable, Logger, Optional } from '@nestjs/common';
import { DataSource, In, LessThanOrEqual } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { IntegrationTenant } from '@gauzy/core';
import { EverWorksApiError, EverWorksNetworkError } from '../../client/ever-works-client';
import { EverWorksConnection } from '../../connection/ever-works-connection.entity';
import { EverWorksNotifier } from '../../connection/ever-works-notifier.service';
import { EverWorksLinkType, EverWorksOutboundChange, EverWorksOutboundStatus } from '../entities/ever-works-sync.entities';
import { EverWorksSyncLogService } from '../ever-works-sync-log.service';
import { assertLeaseFence, EverWorksLease, EverWorksLeaseLostError, everWorksLease, withLeaseFence } from '../ever-works-lease-fence';
import { EverWorksStaleLinkError } from '../links/ever-works-link.service';

/** What a push did. */
export type EverWorksPushOutcome =
	| { status: 'pushed'; message?: string }
	| { status: 'skipped'; message: string }
	| { status: 'deferred'; message: string; retryInMs?: number };

/** The context of one push: the connection and the organization mapping the change belongs to. */
export interface EverWorksPushContext {
	connection: EverWorksConnection;
	mapping: IntegrationTenant;
}

/**
 * Pushes one kind of Gauzy record to Ever Works (plan 03 §C.3; tasks in G-P1-9, teams in G-P1-7, …).
 * A handler loads the record fresh, normalises it, diffs it against its link's snapshot (nothing
 * changed → `skipped`: loop guard level 2), creates with `externalRef` + a deterministic
 * `Idempotency-Key` or patches with `If-Match`, and handles 412 / 409 itself.
 */
export interface EverWorksOutboundHandler {
	readonly entityTypes: ReadonlyArray<EverWorksLinkType>;
	push(change: EverWorksOutboundChange, context: EverWorksPushContext): Promise<EverWorksPushOutcome>;
}

/** Attempts before a change is dead (plan 03 §C.3). */
export const OUTBOUND_MAX_ATTEMPTS = 8;
export const OUTBOUND_DEFER_MS = 60 * 60_000;
/** How long a claimed (in-flight) push is held before another pass may take it over. */
export const OUTBOUND_CLAIM_MS = 10 * 60_000;

/**
 * The outbound pusher (plan 03 §C.3): drains a connection's due changes through the handler of their
 * type. No handler yet → `deferred` (hourly), so nothing is lost before a type ships. 429 / 5xx /
 * network → retried with back-off (honouring `Retry-After`); after {@link OUTBOUND_MAX_ATTEMPTS} the
 * change is `dead` and logged. Another 4xx is a `failed` change with the contract's code.
 *
 * With the loop's lease `owner`, each push runs behind the lease fence (`withLeaseFence`): the Gauzy
 * writes a handler makes (a 412 merge or a 409 status written back, its link) check, in their own
 * transaction, that this process still holds the connection's lease. A push that outlived the lease
 * writes nothing more once another process holds it; its change is handed back (due at once, the
 * attempt not counted) and the drain stops.
 */
@Injectable()
export class EverWorksOutboundPusher {
	private readonly logger = new Logger('EverWorksPusher');
	private readonly handlers = new Map<string, EverWorksOutboundHandler>();

	constructor(
		private readonly dataSource: DataSource,
		private readonly log: EverWorksSyncLogService,
		/** Tells the admin about a change that stopped (an Inbox notice, G-P3-5); absent in bare test wiring. */
		@Optional() private readonly notifier?: EverWorksNotifier
	) {}

	register(handler: EverWorksOutboundHandler): void {
		for (const type of handler.entityTypes) this.handlers.set(type, handler);
	}

	/** Whether a handler pushes this record type (the initial sync queues only what can be pushed). */
	hasHandler(entityType: EverWorksLinkType | string): boolean {
		return this.handlers.has(entityType);
	}

	/**
	 * Pushes up to `limit` due changes of the connection's mappings; returns how many were settled. With
	 * `owner` (the sync loop's lease holder) every push is fenced on the connection's lease.
	 */
	async drain(
		connection: EverWorksConnection,
		limit = 100,
		now: Date = new Date(),
		stillOwner?: () => Promise<boolean>,
		owner?: string
	): Promise<number> {
		const mappings = await this.mappingsOf(connection);
		if (!mappings.length) return 0;
		const repository = this.dataSource.getRepository(EverWorksOutboundChange);
		const due = await repository.find({
			where: {
				integrationTenantId: In(mappings.map((m) => m.id as ID)),
				// PUSHING rows are due only once their claim has lapsed (a process stopped mid-push).
				status: In([EverWorksOutboundStatus.PENDING, EverWorksOutboundStatus.DEFERRED, EverWorksOutboundStatus.FAILED, EverWorksOutboundStatus.PUSHING]),
				availableAt: LessThanOrEqual(now)
			},
			order: { availableAt: 'ASC' },
			take: limit
		});
		const lease = owner ? everWorksLease(this.dataSource, connection.id as ID, owner, now) : null;
		let settled = 0;
		try {
			for (const change of due) {
				if (stillOwner && !(await stillOwner())) return settled;
				const mapping = mappings.find((m) => m.id === change.integrationTenantId) as IntegrationTenant;
				if (await this.pushOne(connection, mapping, change, now, lease)) settled++;
			}
		} catch (error) {
			if (!(error instanceof EverWorksLeaseLostError)) throw error;
			this.logger.warn(`Connection ${connection.id}: the lease moved to another process; the outbound drain stopped.`);
		}
		return settled;
	}

	private async pushOne(
		connection: EverWorksConnection,
		mapping: IntegrationTenant,
		change: EverWorksOutboundChange,
		now: Date,
		lease: EverWorksLease | null = null
	): Promise<boolean> {
		const repository = this.dataSource.getRepository(EverWorksOutboundChange);
		const handler = this.handlers.get(change.entityType);
		if (!handler) {
			await repository.update(
				{ id: change.id, status: change.status },
				{ status: EverWorksOutboundStatus.DEFERRED, lastError: `no handler for ${change.entityType} yet`, availableAt: new Date(now.getTime() + OUTBOUND_DEFER_MS) }
			);
			return true;
		}
		// Claim it first: from here a new trigger for this record opens a new pending change instead of
		// merging into this one, so an edit made during the push is pushed after it, not lost.
		// The claim is its own token: the whole second its hold ends at (stored exactly on every dialect,
		// MySQL DATETIME included). Every result below is written only while that claim still stands, so a
		// push whose claim lapsed and was taken over never overwrites the newer push.
		const claimUntil = new Date(Math.ceil((now.getTime() + OUTBOUND_CLAIM_MS) / 1000) * 1000);
		// A lapsed claim is taken over on its own token (the hold it was read with): of two passes that both
		// read it as lapsed, only the first takes it.
		const lapsed = change.status === EverWorksOutboundStatus.PUSHING && change.availableAt ? { availableAt: change.availableAt } : {};
		const claimed = await repository.update(
			{ id: change.id, status: change.status, ...lapsed } as never,
			{ status: EverWorksOutboundStatus.PUSHING, availableAt: claimUntil }
		);
		if (!claimed.affected) return false; // another process took it
		const ours = { id: change.id, status: EverWorksOutboundStatus.PUSHING, availableAt: claimUntil };
		const settle = async (values: Record<string, unknown>): Promise<boolean> => {
			const result = await repository.update(ours as never, values as never);
			if (!result.affected) {
				this.logger.warn(`Connection ${connection.id}: the claim on the ${change.entityType} change of ${change.gauzyId} lapsed; its result was dropped.`);
				return false;
			}
			return true;
		};
		try {
			// Fenced: a Gauzy write of this push made after the lease moved is refused. The lease is also checked
			// before the handler starts, since its Ever Works request goes out before its first Gauzy write.
			const outcome = await withLeaseFence(lease, async () => {
				await assertLeaseFence();
				return handler.push(change, { connection, mapping });
			});
			if (outcome.status === 'deferred') {
				await settle({
					status: EverWorksOutboundStatus.DEFERRED,
					lastError: outcome.message.slice(0, 2000),
					availableAt: new Date(now.getTime() + (outcome.retryInMs ?? OUTBOUND_DEFER_MS))
				});
				return false;
			}
			return await settle({
				status: outcome.status === 'pushed' ? EverWorksOutboundStatus.PUSHED : EverWorksOutboundStatus.SKIPPED,
				lastError: outcome.status === 'skipped' ? outcome.message.slice(0, 2000) : null
			});
		} catch (error) {
			if (error instanceof EverWorksLeaseLostError) {
				// Handed back to the process that holds the lease now: due at once, this attempt not counted.
				await settle({ status: EverWorksOutboundStatus.FAILED, lastError: error.message.slice(0, 2000), availableAt: now });
				throw error;
			}
			const attempts = (change.attempts ?? 0) + 1;
			// A link write refused as older than the recorded version (a newer event or push recorded first) is
			// retried: the next push recomputes the change against the newer snapshot.
			const retryable =
				error instanceof EverWorksNetworkError || (error instanceof EverWorksApiError && error.retryable) || error instanceof EverWorksStaleLinkError;
			// A refusal (4xx other than 429) does not change by retrying: it is terminal at once.
			const dead = !retryable || attempts >= OUTBOUND_MAX_ATTEMPTS;
			const reason =
				error instanceof EverWorksApiError
					? `${error.status} ${error.code}: ${error.message}`
					: error instanceof Error
						? `${error.name}: ${error.message}`
						: 'error';
			const retryAfterMs = error instanceof EverWorksApiError && error.retryAfterSeconds !== null ? error.retryAfterSeconds * 1000 : 0;
			const written = await settle({
				status: dead ? EverWorksOutboundStatus.DEAD : EverWorksOutboundStatus.FAILED,
				attempts,
				lastError: reason.slice(0, 2000),
				availableAt: new Date(now.getTime() + Math.max(retryAfterMs, Math.min(60 * 60_000, 2 ** attempts * 1000)))
			});
			if (dead && written) {
				await this.log.write({
					tenantId: change.tenantId as ID,
					organizationId: change.organizationId as ID,
					integrationTenantId: change.integrationTenantId,
					connectionId: connection.id as ID,
					direction: 'outbound',
					entityType: change.entityType,
					gauzyId: change.gauzyId,
					action: retryable ? 'dead_letter' : 'push_refused',
					status: 'error',
					message: reason
				});
				this.logger.warn(`Connection ${connection.id}: the ${change.entityType} change of ${change.gauzyId} stopped (${reason.slice(0, 200)}).`);
				// Best effort: a notice must never stop the pusher.
				await this.notifier
					?.deadLetter(connection, {
						direction: 'outbound',
						entityType: change.entityType,
						recordId: change.gauzyId,
						reason
					})
					.catch((noticeError) =>
						this.logger.warn(`Connection ${connection.id}: the dead-letter notice failed (${noticeError instanceof Error ? noticeError.message : 'error'}).`)
					);
			}
			return false;
		}
	}

	private async mappingsOf(connection: EverWorksConnection): Promise<IntegrationTenant[]> {
		const rows = await this.dataSource.getRepository(IntegrationTenant).find({
			where: { tenantId: connection.tenantId, isActive: true, isArchived: false },
			relations: { settings: true }
		});
		return rows.filter(
			(row) =>
				row.settings?.some((s) => s.settingsName === 'CONNECTION_ID' && s.settingsValue === connection.id) &&
				row.settings?.some((s) => s.settingsName === 'IS_ENABLED' && s.settingsValue === 'true')
		);
	}
}
