import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { IntegrationTenant } from '@gauzy/core';
import { EVER_WORKS_INTEGRATION_NAME } from '../../ever-works.constants';
import { EverWorksSettingName } from '../../ever-works-setting.enum';
import { EverWorksLinkType, EverWorksOutboundChange, EverWorksOutboundStatus } from '../entities/ever-works-sync.entities';

/** A Gauzy change to push (a hint: the push recomputes the full state). */
export interface EverWorksOutboundTrigger {
	tenantId: ID;
	organizationId: ID;
	entityType: EverWorksLinkType;
	gauzyId: ID;
	op?: 'upsert' | 'delete';
	changedFields?: string[];
	actorUserId?: ID | null;
}

/** Changes wait this long before they are pushed, so a burst of edits becomes one push (plan 03 §C.7). */
export const OUTBOUND_DEBOUNCE_MS = 2_000;

/** How long a resolved mapping is cached per organization. */
const MAPPING_CACHE_MS = 30_000;

/**
 * The outbound queue (plan 03 §C.2): one pending `ever_works_outbound_change` per mapping, type and
 * record; a new trigger merges into it (a delete wins, the changed-field hints are united, the debounce
 * restarts). Triggers for an organization without an active, enabled Ever Works mapping are dropped.
 */
@Injectable()
export class EverWorksOutboundQueue {
	private readonly logger = new Logger('EverWorksOutbound');
	private readonly mappings = new Map<string, { id: ID; at: number }>();
	private readonly inFlight = new Map<string, Promise<boolean>>();

	constructor(private readonly dataSource: DataSource) {}

	/**
	 * The active, enabled mapping of an organization, or `null`. Only a found mapping is cached (briefly):
	 * an organization mapped or enabled a moment ago is seen at once, so its first edits are not dropped.
	 */
	async mappingFor(tenantId: ID, organizationId: ID, now = Date.now()): Promise<ID | null> {
		const key = `${tenantId}:${organizationId}`;
		const cached = this.mappings.get(key);
		if (cached && now - cached.at < MAPPING_CACHE_MS) return cached.id;
		const row = await this.dataSource.getRepository(IntegrationTenant).findOne({
			where: { tenantId, organizationId, name: EVER_WORKS_INTEGRATION_NAME, isActive: true, isArchived: false },
			relations: { settings: true }
		});
		const enabled = row?.settings?.find((s) => s.settingsName === EverWorksSettingName.IS_ENABLED)?.settingsValue === 'true';
		const id = row?.id && enabled ? (row.id as ID) : null;
		if (id) this.mappings.set(key, { id, at: now });
		else this.mappings.delete(key);
		return id;
	}

	/** Forgets the cached mappings (after a mapping changes). */
	invalidate(): void {
		this.mappings.clear();
	}

	/** Enqueues (or coalesces) a change; returns false when the organization is not mapped. */
	async enqueue(trigger: EverWorksOutboundTrigger, now: Date = new Date()): Promise<boolean> {
		const integrationTenantId = await this.mappingFor(trigger.tenantId, trigger.organizationId, now.getTime());
		if (!integrationTenantId) return false;
		// One enqueue per record at a time in this process (the listener does not wait for the previous one).
		const key = `${integrationTenantId}:${trigger.entityType}:${trigger.gauzyId}`;
		const previous = this.inFlight.get(key) ?? Promise.resolve();
		const current = previous.catch(() => undefined).then(() => this.enqueueLocked(integrationTenantId, key, trigger, now));
		this.inFlight.set(key, current);
		try {
			return await current;
		} finally {
			if (this.inFlight.get(key) === current) this.inFlight.delete(key);
		}
	}

	/**
	 * Reads and writes the pending change of a record inside one transaction under a database lock, so
	 * processes cannot overwrite each other's delete or hints, nor insert two pending rows (MySQL has no
	 * partial unique index): a Postgres advisory lock per record, the mapping row on MySQL, the single
	 * writer on SQLite.
	 */
	private async enqueueLocked(integrationTenantId: ID, key: string, trigger: EverWorksOutboundTrigger, now: Date): Promise<boolean> {
		const availableAt = new Date(now.getTime() + OUTBOUND_DEBOUNCE_MS);
		return this.dataSource.transaction(async (manager) => {
			const type = manager.connection.options.type;
			if (type === 'postgres') {
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`ever-works:outbound:${key}`]);
			} else if (type === 'mysql' || type === 'mariadb') {
				await manager.findOne(IntegrationTenant, { where: { id: integrationTenantId }, lock: { mode: 'pessimistic_write' } });
			}
			const repository = manager.getRepository(EverWorksOutboundChange);
			const pending = await repository.findOne({
				where: { integrationTenantId, entityType: trigger.entityType, gauzyId: trigger.gauzyId, status: EverWorksOutboundStatus.PENDING }
			});
			if (pending) {
				const hints = new Set<string>([...this.parse(pending.changedFieldsHint), ...(trigger.changedFields ?? [])]);
				await repository.update(
					{ id: pending.id },
					{
						op: pending.op === 'delete' || trigger.op === 'delete' ? 'delete' : 'upsert',
						changedFieldsHint: JSON.stringify([...hints]),
						actorUserId: trigger.actorUserId ?? pending.actorUserId ?? null,
						availableAt
					}
				);
				return true;
			}
			await repository.insert({
				id: randomUUID(),
				tenantId: trigger.tenantId,
				organizationId: trigger.organizationId,
				integrationTenantId,
				entityType: trigger.entityType,
				gauzyId: trigger.gauzyId,
				op: trigger.op ?? 'upsert',
				changedFieldsHint: JSON.stringify(trigger.changedFields ?? []),
				actorUserId: trigger.actorUserId ?? null,
				status: EverWorksOutboundStatus.PENDING,
				attempts: 0,
				availableAt
			} as never);
			return true;
		});
	}

	private parse(raw: string | null | undefined): string[] {
		try {
			const value = JSON.parse(raw || '[]');
			return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
		} catch {
			return [];
		}
	}
}
