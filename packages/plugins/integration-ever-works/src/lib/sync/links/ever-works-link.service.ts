import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { EverWorksEntityLink, EverWorksLinkState, EverWorksLinkType } from '../entities/ever-works-sync.entities';

/** What a link records after a sync in either direction. */
export interface EverWorksLinkInput {
	tenantId: ID;
	organizationId: ID;
	integrationTenantId: ID;
	entityType: EverWorksLinkType;
	gauzyId: ID;
	ewId: string;
	ewVersion?: number | null;
	ewUpdatedAt?: Date | string | null;
	gauzyUpdatedAt?: Date | string | null;
	snapshot?: Record<string, unknown> | null;
	ewOnly?: Record<string, unknown> | null;
	direction: 'inbound' | 'outbound';
	state?: EverWorksLinkState;
}

/**
 * The identity map (`ever_works_entity_link`): one Gauzy record ↔ one Ever Works record per mapping and
 * type, unique on both sides. Handlers read a link before they write and record it after.
 */
@Injectable()
export class EverWorksLinkService {
	constructor(private readonly dataSource: DataSource) {}

	private repo(manager?: EntityManager) {
		return (manager ?? this.dataSource.manager).getRepository(EverWorksEntityLink);
	}

	byEw(integrationTenantId: ID, entityType: EverWorksLinkType, ewId: string, manager?: EntityManager): Promise<EverWorksEntityLink | null> {
		return this.repo(manager).findOne({ where: { integrationTenantId, entityType, ewId } });
	}

	byGauzy(integrationTenantId: ID, entityType: EverWorksLinkType, gauzyId: ID, manager?: EntityManager): Promise<EverWorksEntityLink | null> {
		return this.repo(manager).findOne({ where: { integrationTenantId, entityType, gauzyId } });
	}

	list(integrationTenantId: ID, entityType: EverWorksLinkType, manager?: EntityManager): Promise<EverWorksEntityLink[]> {
		return this.repo(manager).find({ where: { integrationTenantId, entityType } });
	}

	/** The snapshot of a link (the shared fields at the last sync), or `{}`. */
	snapshot<T = Record<string, unknown>>(link: EverWorksEntityLink | null | undefined): Partial<T> {
		if (!link?.snapshot) return {};
		try {
			return JSON.parse(link.snapshot) as Partial<T>;
		} catch {
			return {};
		}
	}

	/**
	 * Records a link: updates the row of the Ever Works id (or, failing that, of the Gauzy id), or inserts
	 * one. A unique-index race with another process is retried once as an update.
	 */
	async record(input: EverWorksLinkInput, manager?: EntityManager): Promise<EverWorksEntityLink> {
		for (let attempt = 0; attempt < 2; attempt++) {
			const repository = this.repo(manager);
			const existing =
				(await this.byEw(input.integrationTenantId, input.entityType, input.ewId, manager)) ??
				(await this.byGauzy(input.integrationTenantId, input.entityType, input.gauzyId, manager));
			const values = {
				gauzyId: input.gauzyId,
				ewId: input.ewId,
				...(input.ewVersion !== undefined ? { ewVersion: input.ewVersion } : {}),
				...(input.ewUpdatedAt !== undefined ? { ewUpdatedAt: input.ewUpdatedAt ? new Date(input.ewUpdatedAt) : null } : {}),
				...(input.gauzyUpdatedAt !== undefined ? { gauzyUpdatedAt: input.gauzyUpdatedAt ? new Date(input.gauzyUpdatedAt) : null } : {}),
				...(input.snapshot !== undefined ? { snapshot: input.snapshot ? JSON.stringify(input.snapshot) : null } : {}),
				...(input.ewOnly !== undefined ? { ewOnly: input.ewOnly ? JSON.stringify(input.ewOnly) : null } : {}),
				lastDirection: input.direction,
				lastSyncedAt: new Date(),
				state: input.state ?? EverWorksLinkState.OK,
				lastError: null
			};
			if (existing) {
				await repository.update({ id: existing.id }, values as never);
				return { ...existing, ...values } as EverWorksEntityLink;
			}
			try {
				const row = {
					id: randomUUID(),
					tenantId: input.tenantId,
					organizationId: input.organizationId,
					integrationTenantId: input.integrationTenantId,
					entityType: input.entityType,
					...values
				};
				await repository.insert(row as never);
				return row as unknown as EverWorksEntityLink;
			} catch (error) {
				if (attempt === 1) throw error;
			}
		}
		throw new Error('unreachable');
	}

	/** Deletes a link (a pairing an admin undid; neither record is touched). */
	async remove(link: EverWorksEntityLink, manager?: EntityManager): Promise<void> {
		await this.repo(manager).delete({ id: link.id });
	}

	/** Marks a link as no longer synced (both records are kept). */
	async unlink(link: EverWorksEntityLink, reason: string, manager?: EntityManager): Promise<void> {
		await this.repo(manager).update({ id: link.id }, { state: EverWorksLinkState.UNLINKED, lastError: reason.slice(0, 2000) });
	}
}
