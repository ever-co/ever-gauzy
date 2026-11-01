import { ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, In, IsNull } from 'typeorm';
import { ID, IntegrationEntity } from '@gauzy/contracts';
import { Employee, Organization, RequestContext } from '@gauzy/core';
import { EverWorksConnectionStatus } from '../connection/ever-works-connection.entity';
import { entitySynced } from '../mapping/ever-works-mapping.defaults';
import { EverWorksMappingContext, EverWorksMappingContextService } from '../mapping/ever-works-mapping-context.service';
import { EverWorksLinkState, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { toEverWorks } from '../sync/initial/ever-works-sync-phases';
import { EverWorksLinkService } from '../sync/links/ever-works-link.service';
import { EverWorksInboxPreference } from './ever-works-inbox-preference.entity';
import {
	allEverWorksInboxKinds,
	EVER_WORKS_INBOX_KINDS,
	EverWorksInboxKind,
	isEverWorksInboxKind
} from './ever-works-inbox-kinds';

/** Why a person's items of an organization are not sent to Ever Works (`null` while they are). */
export type EverWorksInboxSendReason =
	'mapping_disabled' | 'connection_inactive' | 'missing_scope' | 'sync_setting_off' | 'direction' | 'not_paired';

/** `GET /me/inbox-preferences`: what the signed-in person sends to Ever Works, and where it goes. */
export interface EverWorksInboxPreferencesView {
	/** The kinds, in display order. */
	available: EverWorksInboxKind[];
	/** `true`: sent to Ever Works. Every kind is on by default. */
	kinds: Record<EverWorksInboxKind, boolean>;
	/** When the person last saved (`null`: never; the defaults apply). */
	updatedAt: Date | null;
	/** The Ever Works-mapped organizations of the tenant the person works in, and whether their items go there now. */
	organizations: Array<{
		organizationId: ID;
		organizationName: string | null;
		paired: boolean;
		sending: boolean;
		reason: EverWorksInboxSendReason | null;
	}>;
}

/** A person's effective choice, as the People tab shows it. */
export interface EverWorksInboxPreferenceSummary {
	kinds: Record<EverWorksInboxKind, boolean>;
	/** `false` while the person never saved a choice (once saved, `true` even when every kind is back on). */
	customized: boolean;
}

/** User ids one `IN` list names at most. */
const IN_CHUNK = 500;
/** Attempts of one save against overlapping saves of the same person. */
const SAVE_ATTEMPTS = 5;

/** The stored excluded kinds (anything unreadable or unknown is ignored: that kind stays on). */
function excludedOf(row: Pick<EverWorksInboxPreference, 'excludedKinds'> | null | undefined): Set<EverWorksInboxKind> {
	if (!row?.excludedKinds) return new Set();
	try {
		const parsed = JSON.parse(row.excludedKinds);
		return new Set(Array.isArray(parsed) ? parsed.filter(isEverWorksInboxKind) : []);
	} catch {
		return new Set();
	}
}

function kindsOf(excluded: Set<EverWorksInboxKind>): Record<EverWorksInboxKind, boolean> {
	const kinds = allEverWorksInboxKinds();
	for (const kind of excluded) kinds[kind] = false;
	return kinds;
}

/**
 * Each person's control over what of their Gauzy Inbox goes to Ever Works (owner decision 2026-10-29): per user and
 * tenant, the kinds they keep out (`ever_works_inbox_preference`). Everything is sent by default, emails included;
 * a person may exclude any kind. The person reads and changes only their own choice (`/me/inbox-preferences`); an
 * admin sees each paired person's effective choice on the People tab.
 */
@Injectable()
export class EverWorksInboxPreferencesService {
	private readonly logger = new Logger('EverWorksInboxPreferences');

	constructor(
		private readonly dataSource: DataSource,
		private readonly contexts: EverWorksMappingContextService,
		private readonly links: EverWorksLinkService
	) {}

	// ── The pusher ─────────────────────────────────────────────────────────────────────────────────

	/** Whether a person sends items of a kind to Ever Works (no stored choice: yes). */
	async allows(tenantId: ID, userId: ID, kind: EverWorksInboxKind): Promise<boolean> {
		return !excludedOf(await this.row(tenantId, userId)).has(kind);
	}

	/** The effective choice of several people of a tenant (one entry per user id given). */
	async summaries(tenantId: ID, userIds: ID[]): Promise<Map<ID, EverWorksInboxPreferenceSummary>> {
		const users = [...new Set(userIds.filter(Boolean))];
		const rows: EverWorksInboxPreference[] = [];
		for (let start = 0; start < users.length; start += IN_CHUNK) {
			rows.push(
				...(await this.repository().find({
					where: { tenantId, userId: In(users.slice(start, start + IN_CHUNK)) } as never
				}))
			);
		}
		const byUser = new Map(rows.map((row) => [row.userId as ID, row]));
		return new Map(
			users.map((userId) => {
				const excluded = excludedOf(byUser.get(userId));
				// Customized once the person saved a choice, even one that turned every kind back on.
				return [userId, { kinds: kindsOf(excluded), customized: byUser.has(userId) }];
			})
		);
	}

	// ── The signed-in person ───────────────────────────────────────────────────────────────────────

	/** `GET /me/inbox-preferences`. */
	async mine(): Promise<EverWorksInboxPreferencesView> {
		const { tenantId, userId } = this.caller();
		return this.view(tenantId, userId);
	}

	/**
	 * `PUT /me/inbox-preferences`: the kinds stated change, the others keep their value. One row per person and
	 * tenant; two overlapping saves end with one row (the unique index catches the second insert, which updates).
	 */
	async updateMine(kinds: Partial<Record<EverWorksInboxKind, boolean>>): Promise<EverWorksInboxPreferencesView> {
		const { tenantId, userId } = this.caller();
		for (let attempt = 0; ; attempt++) {
			if (attempt === SAVE_ATTEMPTS) throw new ConflictException('Your choice changed meanwhile; save it again.');
			const row = await this.row(tenantId, userId);
			const excluded = excludedOf(row);
			for (const kind of EVER_WORKS_INBOX_KINDS) {
				const value = kinds?.[kind];
				if (value === true) excluded.delete(kind);
				else if (value === false) excluded.add(kind);
			}
			const excludedKinds = JSON.stringify(EVER_WORKS_INBOX_KINDS.filter((kind) => excluded.has(kind)));
			if (row) {
				// Only over the value this save read (compare and set): an overlapping save of other kinds is merged by the
				// next attempt instead of overwritten.
				const result = await this.repository().update(
					{ id: row.id, excludedKinds: row.excludedKinds ?? IsNull() } as never,
					{ excludedKinds } as never
				);
				if ((result.affected ?? 0) > 0) break;
				continue;
			}
			try {
				await this.repository().insert({
					id: randomUUID(),
					tenantId,
					organizationId: null,
					userId,
					excludedKinds
				} as never);
				break;
			} catch (error) {
				// Another save inserted the row meanwhile: the next attempt merges into it. Still no row: a real failure
				// (a connection, a constraint), which no retry fixes and which must not read as "changed meanwhile".
				if (!(await this.row(tenantId, userId))) throw error;
			}
		}
		this.logger.log(`User ${userId} changed what of their Gauzy Inbox goes to Ever Works.`);
		return this.view(tenantId, userId);
	}

	private async view(tenantId: ID, userId: ID): Promise<EverWorksInboxPreferencesView> {
		const row = await this.row(tenantId, userId);
		return {
			available: [...EVER_WORKS_INBOX_KINDS],
			kinds: kindsOf(excludedOf(row)),
			updatedAt: row?.updatedAt ?? null,
			organizations: await this.organizationsOf(tenantId, userId)
		};
	}

	/**
	 * The person's Ever Works-mapped organizations, and whether their items go there now: every organization the person
	 * is an employee of, inactive or archived too (the push sends while the pairing is live, so the list says so).
	 */
	private async organizationsOf(tenantId: ID, userId: ID): Promise<EverWorksInboxPreferencesView['organizations']> {
		const employees = await this.dataSource.getRepository(Employee).find({
			where: { tenantId, userId } as never,
			select: { id: true, organizationId: true } as never
		});
		const result: EverWorksInboxPreferencesView['organizations'] = [];
		for (const employee of employees) {
			if (!employee.organizationId) continue;
			const context = await this.contexts.forOrganization(tenantId, employee.organizationId as ID);
			if (!context) continue;
			const link = await this.links.byGauzy(
				context.integrationTenantId,
				EverWorksLinkType.MEMBER,
				employee.id as ID
			);
			const paired = !!link && link.state !== EverWorksLinkState.UNLINKED;
			const reason = sendReason(context, paired);
			const organization = await this.dataSource.getRepository(Organization).findOne({
				where: { id: employee.organizationId, tenantId } as never,
				select: { id: true, name: true } as never
			});
			result.push({
				organizationId: employee.organizationId as ID,
				organizationName: organization?.name ?? null,
				paired,
				sending: reason === null,
				reason
			});
		}
		return result;
	}

	private caller(): { tenantId: ID; userId: ID } {
		const tenantId = RequestContext.currentTenantId() as ID | null;
		const userId = RequestContext.currentUserId() as ID | null;
		if (!tenantId || !userId) throw new ForbiddenException('A signed-in user of a tenant is required.');
		return { tenantId, userId };
	}

	private row(tenantId: ID, userId: ID): Promise<EverWorksInboxPreference | null> {
		return this.repository().findOne({ where: { tenantId, userId } as never });
	}

	private repository() {
		return this.dataSource.getRepository(EverWorksInboxPreference);
	}
}

/** Why a paired (or not) person's Gauzy Inbox items of a mapping are not sent, or `null` while they are. */
/** The connection key's scopes (an unreadable list holds none). */
function keyScopesOf(context: EverWorksMappingContext): string[] {
	try {
		const scopes = JSON.parse(context.connection.scopes || '[]');
		return Array.isArray(scopes) ? scopes.filter((scope): scope is string => typeof scope === 'string') : [];
	} catch {
		return [];
	}
}

export function sendReason(context: EverWorksMappingContext, paired: boolean): EverWorksInboxSendReason | null {
	if (!context.isEnabled) return 'mapping_disabled';
	if (context.connection.status !== EverWorksConnectionStatus.ACTIVE) return 'connection_inactive';
	// The connection's key must be allowed to file inbox items (`inbox:write`), else Ever Works refuses every copy.
	if (!keyScopesOf(context).includes('inbox:write')) return 'missing_scope';
	if (!entitySynced(context, IntegrationEntity.INBOX_ITEM)) return 'sync_setting_off';
	if (!toEverWorks(context.directions.inbox)) return 'direction';
	if (!paired) return 'not_paired';
	return null;
}
