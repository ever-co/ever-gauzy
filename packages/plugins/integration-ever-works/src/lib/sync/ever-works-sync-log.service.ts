import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, LessThan, Not } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { EverWorksSyncLog } from './entities/ever-works-sync.entities';

/** One sync log entry (plan 03 §C.1). */
export interface EverWorksSyncLogInput {
	tenantId: ID;
	organizationId?: ID | null;
	integrationTenantId?: ID | null;
	connectionId?: ID | null;
	direction: 'inbound' | 'outbound' | 'system';
	entityType?: string | null;
	gauzyId?: ID | null;
	ewId?: string | null;
	action: string;
	status: 'ok' | 'skipped' | 'conflict' | 'error';
	message?: string | null;
	details?: Record<string, unknown> | null;
}

/** Retention of the sync log; conflicts are kept until resolved (plan 03 §C.1). */
export const SYNC_LOG_RETENTION_MS = 30 * 24 * 60 * 60_000;

/** Writes and prunes the sync log. Messages are short codes and texts, never a key or a payload. */
@Injectable()
export class EverWorksSyncLogService {
	constructor(private readonly dataSource: DataSource) {}

	async write(input: EverWorksSyncLogInput): Promise<void> {
		await this.dataSource.getRepository(EverWorksSyncLog).insert({
			id: randomUUID(),
			tenantId: input.tenantId,
			organizationId: input.organizationId ?? undefined,
			integrationTenantId: input.integrationTenantId ?? null,
			connectionId: input.connectionId ?? null,
			direction: input.direction,
			entityType: input.entityType ?? null,
			gauzyId: input.gauzyId ?? null,
			ewId: input.ewId ?? null,
			action: input.action.slice(0, 64),
			status: input.status,
			message: input.message ? input.message.slice(0, 2000) : null,
			details: input.details ? serializeDetails(input.details) : null
		} as never);
	}

	/** Deletes entries older than the retention, except unresolved conflicts. */
	async prune(now: Date = new Date()): Promise<number> {
		const cutoff = new Date(now.getTime() - SYNC_LOG_RETENTION_MS);
		const repository = this.dataSource.getRepository(EverWorksSyncLog);
		const old = await repository.delete({ createdAt: LessThan(cutoff), status: Not('conflict') } as never);
		const resolved = await repository.delete({ createdAt: LessThan(cutoff), status: 'conflict', resolvedAt: LessThan(now) } as never);
		return (old.affected ?? 0) + (resolved.affected ?? 0);
	}
}

/** The most a log entry's `details` holds. */
export const SYNC_LOG_DETAILS_MAX = 20_000;

/**
 * `details` as JSON, always valid: above {@link SYNC_LOG_DETAILS_MAX} characters a placeholder records
 * the size and the start of the JSON (as a string), so a consumer's `JSON.parse` never fails on a cut.
 */
export function serializeDetails(details: unknown): string {
	const json = JSON.stringify(details);
	if (json.length <= SYNC_LOG_DETAILS_MAX) return json;
	return JSON.stringify({ truncated: true, length: json.length, preview: json.slice(0, 2_000) });
}
