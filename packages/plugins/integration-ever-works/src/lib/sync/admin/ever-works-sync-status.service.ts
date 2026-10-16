import { Injectable } from '@nestjs/common';
import { Brackets, DataSource } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { EverWorksConnectionStatus } from '../../connection/ever-works-connection.entity';
import { EverWorksConnectionService } from '../../connection/ever-works-connection.service';
import type { EverWorksDirection, EverWorksDomain } from '../../mapping/ever-works-mapping.defaults';
import { EverWorksMappingContext, EverWorksMappingContextService } from '../../mapping/ever-works-mapping-context.service';
import { clampLimit, EverWorksConflictsService, parseBefore } from '../conflicts/ever-works-conflicts.service';
import {
	EverWorksEntityLink,
	EverWorksInboundEvent,
	EverWorksInboundStatus,
	EverWorksOutboundChange,
	EverWorksOutboundStatus,
	EverWorksSyncLog
} from '../entities/ever-works-sync.entities';
import { describeSyncError } from '../ever-works-sync.loop';
import { EverWorksInitialSyncService, EverWorksSyncRunView } from '../initial/ever-works-initial-sync.service';

/** `GET /mappings/:id/sync/status` (plan 03 §C.7 "Observability"). */
export interface EverWorksSyncStatusView {
	integrationTenantId: ID;
	organizationId: ID;
	isEnabled: boolean;
	directions: Record<EverWorksDomain, EverWorksDirection>;
	connection: {
		id: ID;
		status: EverWorksConnectionStatus;
		lastError: string | null;
		lastErrorAt: Date | null;
		lastHealthyAt: Date | null;
		lastFeedPollAt: Date | null;
		lastWebhookAt: Date | null;
		resyncRequested: boolean;
	};
	/** Ever Works' feed head against what Gauzy has read and applied (`behind` = head − last applied). */
	lag: { head: string | null; readUpTo: string | null; lastApplied: string | null; behind: string | null; headError: string | null };
	inbound: Record<'pending' | 'deferred' | 'failed' | 'dead', number>;
	outbound: Record<'pending' | 'pushing' | 'deferred' | 'failed' | 'dead', number>;
	conflicts: { open: number };
	lastError: { at: Date | null; direction: string; entityType: string | null; action: string; message: string | null } | null;
	/** Per linked record type: how many links, by state. */
	entities: Array<{ entityType: string; total: number; ok: number; conflict: number; error: number; orphaned: number; unlinked: number }>;
	/** The latest runs (initial sync, resyncs), newest first; `run` is the running one, if any. */
	run: EverWorksSyncRunView | null;
	runs: EverWorksSyncRunView[];
}

/** One sync log entry as the Activity tab shows it. */
export interface EverWorksSyncLogEntryView {
	id: ID;
	createdAt: Date | null;
	direction: string;
	entityType: string | null;
	gauzyId: ID | null;
	ewId: string | null;
	action: string;
	status: string;
	message: string | null;
	details: unknown;
	resolvedAt: Date | null;
}

/** The filters of the sync log. */
export interface EverWorksSyncLogQuery {
	status?: string;
	direction?: string;
	entityType?: string;
	limit?: string | number;
	before?: string;
}

const LOG_STATUSES = ['ok', 'skipped', 'conflict', 'error'];
const LINK_STATES = ['ok', 'conflict', 'error', 'orphaned', 'unlinked'] as const;
const LOG_DIRECTIONS = ['inbound', 'outbound', 'system'];
export const SYNC_LOG_PAGE_MAX = 200;

/**
 * Observability of a mapping (plan 03 §C.7, plan 06 G-P1-10): the status (lag, queue counts, dead
 * letters, conflicts, the last error, per-type link totals, the runs) and the sync log. Read only; the
 * caller must be an active member of the mapping's organization, and every read is scoped to its tenant
 * and mapping (log rows written by the applier carry the organization instead of the mapping).
 */
@Injectable()
export class EverWorksSyncStatusService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly contexts: EverWorksMappingContextService,
		private readonly connections: EverWorksConnectionService,
		private readonly conflicts: EverWorksConflictsService,
		private readonly runs: EverWorksInitialSyncService
	) {}

	/** `GET /mappings/:id/sync/status`. Asks Ever Works for its feed head (`whoami`); everything else is local. */
	async status(integrationTenantId: ID, organizationId?: ID): Promise<EverWorksSyncStatusView> {
		const context = await this.contexts.forRequest(integrationTenantId, organizationId);
		const connection = context.connection;
		const [inbound, outbound, entities, open, lastError, runs, lastApplied, head] = await Promise.all([
			this.inboundCounts(context),
			this.outboundCounts(context),
			this.linkTotals(context),
			this.conflicts.countOpen(context.tenantId, context.integrationTenantId),
			this.lastError(context),
			this.runs.recent(context.tenantId, context.integrationTenantId, 5),
			this.lastAppliedSeq(context),
			this.feedHead(context)
		]);
		const views = runs.map((run) => this.runs.view(run));
		return {
			integrationTenantId: context.integrationTenantId,
			organizationId: context.organizationId,
			isEnabled: context.isEnabled,
			directions: context.directions,
			connection: {
				id: connection.id as ID,
				status: connection.status,
				lastError: connection.lastError ?? null,
				lastErrorAt: connection.lastErrorAt ?? null,
				lastHealthyAt: connection.lastHealthyAt ?? null,
				lastFeedPollAt: connection.lastFeedPollAt ?? null,
				lastWebhookAt: connection.lastWebhookAt ?? null,
				resyncRequested: !!connection.resyncRequestedAt
			},
			lag: {
				head: head.head,
				readUpTo: connection.feedCursor ?? null,
				lastApplied,
				behind: behind(head.head, lastApplied ?? connection.feedCursor ?? null),
				headError: head.error
			},
			inbound,
			outbound,
			conflicts: { open },
			lastError,
			entities,
			run: views.find((run) => run.status === 'running') ?? null,
			runs: views
		};
	}

	/** `GET /mappings/:id/sync/log`: newest first, filtered by status, direction and record type; `before` pages. */
	async log(integrationTenantId: ID, query: EverWorksSyncLogQuery, organizationId?: ID): Promise<{ items: EverWorksSyncLogEntryView[]; nextBefore: string | null }> {
		const context = await this.contexts.forRequest(integrationTenantId, organizationId);
		const limit = clampLimit(query.limit, 50, SYNC_LOG_PAGE_MAX);
		const before = parseBefore(query.before);
		const builder = this.dataSource
			.getRepository(EverWorksSyncLog)
			.createQueryBuilder('log')
			.where('log.tenantId = :tenantId', { tenantId: context.tenantId })
			.andWhere(this.ofMapping(context));
		if (query.status && LOG_STATUSES.includes(query.status)) builder.andWhere('log.status = :status', { status: query.status });
		if (query.direction && LOG_DIRECTIONS.includes(query.direction)) builder.andWhere('log.direction = :direction', { direction: query.direction });
		if (query.entityType && /^[A-Za-z_.]{1,32}$/.test(query.entityType)) builder.andWhere('log.entityType = :entityType', { entityType: query.entityType });
		if (before) builder.andWhere('log.createdAt < :before', { before });
		const rows = await builder.orderBy('log.createdAt', 'DESC').addOrderBy('log.id', 'DESC').take(limit + 1).getMany();
		const page = rows.slice(0, limit);
		const last = page[page.length - 1] as (EverWorksSyncLog & { createdAt?: Date }) | undefined;
		return {
			items: page.map((row) => ({
				id: row.id as ID,
				createdAt: ((row as { createdAt?: Date }).createdAt as Date) ?? null,
				direction: row.direction,
				entityType: row.entityType ?? null,
				gauzyId: (row.gauzyId as ID) ?? null,
				ewId: row.ewId ?? null,
				action: row.action,
				status: row.status,
				message: row.message ?? null,
				details: parseJson(row.details),
				resolvedAt: row.resolvedAt ?? null
			})),
			nextBefore: rows.length > limit && last?.createdAt ? new Date(last.createdAt).toISOString() : null
		};
	}

	/** Log rows of a mapping: written with the mapping, or (the applier's) with its connection and organization. */
	private ofMapping(context: EverWorksMappingContext): Brackets {
		return new Brackets((where) => {
			where.where('log.integrationTenantId = :integrationTenantId', { integrationTenantId: context.integrationTenantId }).orWhere(
				new Brackets((inner) => {
					inner
						.where('log.integrationTenantId IS NULL')
						.andWhere('log.connectionId = :connectionId', { connectionId: context.connection.id })
						.andWhere('log.organizationId = :organizationId', { organizationId: context.organizationId });
				})
			);
		});
	}

	private async inboundCounts(context: EverWorksMappingContext): Promise<EverWorksSyncStatusView['inbound']> {
		const rows = await this.dataSource
			.getRepository(EverWorksInboundEvent)
			.createQueryBuilder('e')
			.select('e.status', 'status')
			.addSelect('COUNT(*)', 'count')
			.where('e.connectionId = :connectionId', { connectionId: context.connection.id })
			.andWhere('e.organizationId = :organizationId', { organizationId: context.organizationId })
			.andWhere('e.status IN (:...statuses)', {
				statuses: [EverWorksInboundStatus.PENDING, EverWorksInboundStatus.DEFERRED, EverWorksInboundStatus.FAILED, EverWorksInboundStatus.DEAD]
			})
			.groupBy('e.status')
			.getRawMany<{ status: string; count: string | number }>();
		const count = (status: string) => Number(rows.find((row) => row.status === status)?.count ?? 0);
		return { pending: count('pending'), deferred: count('deferred'), failed: count('failed'), dead: count('dead') };
	}

	private async outboundCounts(context: EverWorksMappingContext): Promise<EverWorksSyncStatusView['outbound']> {
		const rows = await this.dataSource
			.getRepository(EverWorksOutboundChange)
			.createQueryBuilder('c')
			.select('c.status', 'status')
			.addSelect('COUNT(*)', 'count')
			.where('c.integrationTenantId = :integrationTenantId', { integrationTenantId: context.integrationTenantId })
			.andWhere('c.status IN (:...statuses)', {
				statuses: [
					EverWorksOutboundStatus.PENDING,
					EverWorksOutboundStatus.PUSHING,
					EverWorksOutboundStatus.DEFERRED,
					EverWorksOutboundStatus.FAILED,
					EverWorksOutboundStatus.DEAD
				]
			})
			.groupBy('c.status')
			.getRawMany<{ status: string; count: string | number }>();
		const count = (status: string) => Number(rows.find((row) => row.status === status)?.count ?? 0);
		return { pending: count('pending'), pushing: count('pushing'), deferred: count('deferred'), failed: count('failed'), dead: count('dead') };
	}

	private async linkTotals(context: EverWorksMappingContext): Promise<EverWorksSyncStatusView['entities']> {
		const rows = await this.dataSource
			.getRepository(EverWorksEntityLink)
			.createQueryBuilder('l')
			.select('l.entityType', 'entityType')
			.addSelect('l.state', 'state')
			.addSelect('COUNT(*)', 'count')
			.where('l.integrationTenantId = :integrationTenantId', { integrationTenantId: context.integrationTenantId })
			.groupBy('l.entityType')
			.addGroupBy('l.state')
			.getRawMany<{ entityType: string; state: string; count: string | number }>();
		const totals = new Map<string, EverWorksSyncStatusView['entities'][number]>();
		for (const row of rows) {
			const entry = totals.get(row.entityType) ?? { entityType: row.entityType, total: 0, ok: 0, conflict: 0, error: 0, orphaned: 0, unlinked: 0 };
			const count = Number(row.count ?? 0);
			entry.total += count;
			if (LINK_STATES.includes(row.state as (typeof LINK_STATES)[number])) entry[row.state as (typeof LINK_STATES)[number]] += count;
			totals.set(row.entityType, entry);
		}
		return [...totals.values()].sort((a, b) => a.entityType.localeCompare(b.entityType));
	}

	private async lastError(context: EverWorksMappingContext): Promise<EverWorksSyncStatusView['lastError']> {
		const row = await this.dataSource
			.getRepository(EverWorksSyncLog)
			.createQueryBuilder('log')
			.where('log.tenantId = :tenantId', { tenantId: context.tenantId })
			.andWhere(this.ofMapping(context))
			.andWhere('log.status = :status', { status: 'error' })
			.orderBy('log.createdAt', 'DESC')
			.addOrderBy('log.id', 'DESC')
			.getOne();
		return row
			? {
					at: ((row as { createdAt?: Date }).createdAt as Date) ?? null,
					direction: row.direction,
					entityType: row.entityType ?? null,
					action: row.action,
					message: row.message ?? null
				}
			: null;
	}

	/** The highest feed position Gauzy applied (or settled) for this mapping's organization. */
	private async lastAppliedSeq(context: EverWorksMappingContext): Promise<string | null> {
		const row = await this.dataSource
			.getRepository(EverWorksInboundEvent)
			.createQueryBuilder('e')
			.select('MAX(e.seq)', 'seq')
			.where('e.connectionId = :connectionId', { connectionId: context.connection.id })
			.andWhere('e.receivedVia IN (:...via)', { via: ['webhook', 'feed'] })
			.andWhere('e.status IN (:...settled)', { settled: [EverWorksInboundStatus.APPLIED, EverWorksInboundStatus.SKIPPED] })
			.getRawOne<{ seq: string | number | null }>();
		return row?.seq === null || row?.seq === undefined ? null : String(row.seq);
	}

	/** Ever Works' feed head, or the reason it could not be read (the status still answers). */
	private async feedHead(context: EverWorksMappingContext): Promise<{ head: string | null; error: string | null }> {
		if (context.connection.status !== EverWorksConnectionStatus.ACTIVE) return { head: null, error: `the connection is ${context.connection.status}` };
		try {
			const whoami = await this.connections.client(context.connection).whoami();
			return { head: whoami.feedHead === undefined || whoami.feedHead === null ? null : String(whoami.feedHead), error: null };
		} catch (error) {
			return { head: null, error: describeSyncError(error) };
		}
	}
}

/** `head − position` as a decimal string (never negative), or `null` when either is unknown. */
export function behind(head: string | null, position: string | null): string | null {
	if (head === null || !/^\d{1,20}$/.test(head)) return null;
	if (position === null || !/^\d{1,20}$/.test(position)) return head;
	const difference = BigInt(head) - BigInt(position);
	return String(difference > 0n ? difference : 0n);
}

function parseJson(raw: string | null | undefined): unknown {
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}
