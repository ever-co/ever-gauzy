import { ConflictException, Injectable } from '@nestjs/common';
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
 * A link write refused because it would lower the link's Ever Works version (plan 03 §C.4, monotonic
 * links): the handler worked from an older state than the one already recorded — it outlived its lease,
 * or a newer event or push recorded first. The newer snapshot stays. The applier settles the event as
 * skipped when the refused link is the event's own record (the newer version covers it) and retries it
 * otherwise; the pusher retries the change against the newer snapshot; an admin action answers `409`.
 */
export class EverWorksStaleLinkError extends ConflictException {
	constructor(
		readonly linkId: ID,
		readonly ewId: string,
		readonly storedVersion: number | null,
		readonly refusedVersion: number | null
	) {
		super(`The link of Ever Works record ${ewId} already records version ${storedVersion}; the write of version ${refusedVersion ?? '(none)'} was refused.`);
		this.name = 'EverWorksStaleLinkError';
	}
}

/**
 * Whether writing `input` over `current` would lower the link's Ever Works version: same Ever Works
 * record, a version stated, and the stored one higher (a stated `null` is lower than any version). A
 * write that states no version (`undefined`), or that pairs the Gauzy record with another Ever Works
 * record, is never refused.
 */
export function wouldLowerLinkVersion(
	current: Pick<EverWorksEntityLink, 'ewId' | 'ewVersion'>,
	input: Pick<EverWorksLinkInput, 'ewId' | 'ewVersion'>
): boolean {
	if (input.ewVersion === undefined || current.ewId !== input.ewId || current.ewVersion == null) return false;
	return input.ewVersion === null || input.ewVersion < current.ewVersion;
}

/** Whether a stored link row already holds the values of a write (its sync time aside). */
function linkHolds(row: EverWorksEntityLink, values: Record<string, unknown>): boolean {
	const stored = row as unknown as Record<string, unknown>;
	return Object.entries(values).every(([key, value]) => {
		if (key === 'lastSyncedAt') return true;
		const current = stored[key] ?? null;
		if (value instanceof Date || current instanceof Date) {
			return value !== null && current !== null && new Date(value as Date).getTime() === new Date(current as Date).getTime();
		}
		return current === (value ?? null);
	});
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
	 *
	 * **Monotonic version:** the update is one conditional statement that never lowers the stored
	 * `ewVersion` of the same Ever Works record (`ewVersion IS NULL OR ewVersion <= :new`), so a handler
	 * that worked from an older state — one that outlived its lease, or lost a race with a newer event or
	 * push — cannot overwrite the newer snapshot; it gets {@link EverWorksStaleLinkError} instead. An equal
	 * version is written (a later write of the same Ever Works state, e.g. the Gauzy side after a push).
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
				if (wouldLowerLinkVersion(existing, input)) throw new EverWorksStaleLinkError(existing.id as ID, existing.ewId, existing.ewVersion ?? null, input.ewVersion ?? null);
				if (await this.updateUnlessLower(existing.id as ID, input, values, manager)) return { ...existing, ...values } as EverWorksEntityLink;
				// Nothing written: a newer version landed since the read (refused), the row is gone (inserted on the
				// next attempt), or it changed otherwise (re-paired: the next attempt reads it again).
				const current = await repository.findOne({ where: { id: existing.id } });
				if (current && wouldLowerLinkVersion(current, input)) throw new EverWorksStaleLinkError(current.id as ID, current.ewId, current.ewVersion ?? null, input.ewVersion ?? null);
				// A driver that counts changed rows only: the row already holds exactly these values.
				if (current && linkHolds(current, values)) return current;
				continue;
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
		throw new Error(`The ${input.entityType} link of Ever Works record ${input.ewId} changed twice while it was being recorded.`);
	}

	/**
	 * One conditional update of a link row: with a stated version, only while the row's version is not
	 * higher (or the row pairs another Ever Works record). Returns whether a row was written.
	 */
	private async updateUnlessLower(id: ID, input: EverWorksLinkInput, values: Record<string, unknown>, manager?: EntityManager): Promise<boolean> {
		const builder = (manager ?? this.dataSource.manager).createQueryBuilder().update(EverWorksEntityLink).set(values as never);
		const q = (name: string) => builder.escape(name);
		builder.where(`${q('id')} = :id`, { id });
		if (input.ewVersion !== undefined) {
			builder.andWhere(
				input.ewVersion === null
					? `(${q('ewId')} <> :ewId OR ${q('ewVersion')} IS NULL)`
					: `(${q('ewId')} <> :ewId OR ${q('ewVersion')} IS NULL OR ${q('ewVersion')} <= :ewVersion)`,
				{ ewId: input.ewId, ...(input.ewVersion === null ? {} : { ewVersion: input.ewVersion }) }
			);
		}
		const result = await builder.execute();
		return (result.affected ?? 0) > 0;
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
