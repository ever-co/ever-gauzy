import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource, In } from 'typeorm';
import { ID, RolesEnum } from '@gauzy/contracts';
import { IntegrationTenant, OrganizationProject, OrganizationTeam, OrganizationTeamEmployee, Role, Task } from '@gauzy/core';
import { EverWorksApiError, EverWorksClient } from '../client/ever-works-client';
import type { EverWorksEventEnvelope, EverWorksListPage } from '../client/ever-works-client.types';
import { EverWorksConnection } from '../connection/ever-works-connection.entity';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import { EVER_WORKS_LINK_SOURCE } from '../ever-works.constants';
import { EverWorksSettingName } from '../ever-works-setting.enum';
import type { EverWorksDirection } from '../mapping/ever-works-mapping.defaults';
import { EverWorksMappingContext, EverWorksMappingContextService } from '../mapping/ever-works-mapping-context.service';
import { EverWorksEntityLink, EverWorksLinkState, EverWorksLinkType, EverWorksOutboundChange } from '../sync/entities/ever-works-sync.entities';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import type { EverWorksApplyContext, EverWorksApplyOutcome, EverWorksInboundHandler } from '../sync/inbound/ever-works-inbound.applier';
import { EverWorksLinkService } from '../sync/links/ever-works-link.service';
import type { EverWorksOutboundHandler, EverWorksPushContext, EverWorksPushOutcome } from '../sync/outbound/ever-works-outbound.pusher';
import { EverWorksOutboundQueue } from '../sync/outbound/ever-works-outbound.queue';
import type { EverWorksSyncSweeper } from '../sync/ever-works-sync.loop';
import { emojiOf } from './ever-works-team-scope';

/** A member of an Ever Works team (contract v1 `TeamMemberRef`). */
export interface EverWorksTeamMemberRef {
	memberType: 'user' | 'agent';
	memberId: string;
	role: 'lead' | 'member';
}

/** A record attached to an Ever Works team (contract v1 `TeamResourceRef`). */
export interface EverWorksTeamResourceRef {
	resourceType: string;
	resourceId: string;
}

/** An Ever Works team (contract v1 team DTO; also the `data` of `team.created/updated/deleted`). */
export interface EverWorksTeam {
	id: string;
	organizationId?: string;
	version?: number;
	updatedAt?: string;
	name: string;
	slug?: string;
	description?: string | null;
	parentTeamId?: string | null;
	managerAgentId?: string | null;
	avatarIcon?: string | null;
	members?: EverWorksTeamMemberRef[];
	resources?: EverWorksTeamResourceRef[];
	webUrl?: string | null;
	deleted?: boolean;
}

/** The shared fields of a team pair at the last sync (the 3-way merge base). */
interface TeamSnapshot {
	name: string;
	emoji: string | null;
	members: Array<{ employeeId: ID; isManager: boolean }>;
}

/** What only Ever Works has, kept on the link (fields one side lacks are preserved, never nulled). */
interface TeamEverWorksOnly {
	slug?: string;
	description?: string | null;
	parentTeamId?: string | null;
	managerAgentId?: string | null;
	avatarIcon?: string | null;
	/** Ever Works' full member set at the last sync, including members Gauzy cannot map. */
	members?: EverWorksTeamMemberRef[];
	resources?: EverWorksTeamResourceRef[];
	/** Members (`<type>:<id>`) Gauzy could not map at the last sync; tried again on the next change and by the sweep. */
	unmapped?: string[];
	/**
	 * Child events (`team.member.*`, `team.resource.*`) are applied by child, not by the team's version (review F75):
	 * the version of the last full team state applied (absent: the link's version is), and the version of the last
	 * child event applied per child (`m:<type>:<id>`, `r:<type>:<id>`) since then.
	 */
	fullVersion?: number | null;
	childVersions?: Record<string, number>;
}

/** The child-event state of a team link (see {@link TeamEverWorksOnly.fullVersion}). */
type TeamChildState = Pick<TeamEverWorksOnly, 'fullVersion' | 'childVersions'>;

/** One Ever Works team as the Teams tab shows it. */
export interface EverWorksTeamRow {
	ewTeamId: string;
	name: string;
	slug: string | null;
	parentTeamId: string | null;
	linkedTeamId: ID | null;
	/** A same-name Gauzy team the admin may confirm (never linked silently), or `null`. */
	suggestion: { teamId: ID; reason: 'same_name' } | null;
}

export interface EverWorksTeamsView {
	teams: EverWorksTeamRow[];
	/** Gauzy teams of the organization linked to no Ever Works team. */
	unmatchedTeams: Array<{ teamId: ID; name: string }>;
}

/** The admin's decisions on the Teams tab. */
export interface EverWorksTeamsDecision {
	links?: Array<{ ewTeamId: string; teamId: ID }>;
	unlinks?: string[];
	acceptSuggestions?: boolean;
	/** Ever Works teams to create in Gauzy. */
	createInGauzy?: string[];
	/** Gauzy teams to create in Ever Works (as top-level teams). */
	createInEverWorks?: ID[];
}

const key = (ref: Pick<EverWorksTeamMemberRef, 'memberType' | 'memberId'>) => `${ref.memberType}:${ref.memberId}`;
const fromEverWorks = (direction: EverWorksDirection | undefined) => direction === 'both' || direction === 'ew_to_gauzy';
const toEverWorks = (direction: EverWorksDirection | undefined) => direction === 'both' || direction === 'gauzy_to_ew';
const sameName = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
/** The platform's rule for a team manager: `isManager`, or the `MANAGER` role on the membership. */
const isManagerMember = (row: { isManager?: boolean; role?: { name?: string } | null }) => !!row.isManager || row.role?.name === RolesEnum.MANAGER;
const sameMembers = (a: Array<{ employeeId: ID; isManager: boolean }>, b: Array<{ employeeId: ID; isManager: boolean }>) => {
	const left = new Map(a.map((m) => [m.employeeId, m.isManager]));
	return a.length === b.length && b.every((m) => left.has(m.employeeId) && left.get(m.employeeId) === m.isManager);
};

/** The child of a `team.member.*` / `team.resource.*` event (`m:<type>:<id>`, `r:<type>:<id>`), or `null` for a team event. */
function childKeyOf(type: string, data: Record<string, unknown>): string | null {
	if (type.startsWith('team.member.')) return `m:${String(data['memberType'])}:${String(data['memberId'])}`;
	if (type.startsWith('team.resource.')) return `r:${String(data['resourceType'])}:${String(data['resourceId'])}`;
	return null;
}

/** The version below which a team link's child events are covered by a full team state (review F75). */
function childFloorOf(link: EverWorksEntityLink, ew: TeamEverWorksOnly): number | null {
	return ew.fullVersion !== undefined ? ew.fullVersion : (link.ewVersion ?? null);
}

/** Whether a child event of this version was applied already: by its own child, or by a full team state as new. */
function childApplied(link: EverWorksEntityLink, ew: TeamEverWorksOnly, child: string, version: number): boolean {
	const floor = childFloorOf(link, ew);
	return (floor != null && version <= floor) || (ew.childVersions?.[child] ?? -Infinity) >= version;
}

/** The child state after applying one child event. */
function childStateAfter(link: EverWorksEntityLink, ew: TeamEverWorksOnly, child: string, version: number | null): TeamChildState {
	return { fullVersion: childFloorOf(link, ew), childVersions: { ...(ew.childVersions ?? {}), ...(version != null ? { [child]: version } : {}) } };
}

/** The child state after a push: Ever Works' answer is not applied to Gauzy, so the floor of the child events stays. */
function childStateAfterPush(link: EverWorksEntityLink, ew: TeamEverWorksOnly): TeamChildState {
	return { fullVersion: childFloorOf(link, ew), ...(ew.childVersions ? { childVersions: ew.childVersions } : {}) };
}

/** The child state as stored, for a record that does not change it. */
function childStateOf(ew: TeamEverWorksOnly): TeamChildState {
	return { ...(ew.fullVersion !== undefined ? { fullVersion: ew.fullVersion } : {}), ...(ew.childVersions ? { childVersions: ew.childVersions } : {}) };
}

/** The link version recorded with a child event: an older child event never lowers it. */
function childRecordVersion(link: EverWorksEntityLink, version: number | null): number | null {
	return link.ewVersion != null && version != null ? Math.max(link.ewVersion, version) : version;
}

/** How often the membership sweep runs per connection. */
export const TEAM_SWEEP_MS = 10 * 60_000;

/**
 * Teams (plan 01 §5, plan 06 G-P1-7), both ways, linked as `TEAM`.
 *
 * - **Fields:** `name` ↔ `name`; `avatarIcon` ↔ `emoji` when it is an emoji. Ever Works nesting
 *   (`parentTeamId`), `slug` and `description` stay on the link; Gauzy teams are flat and sync to Ever
 *   Works as top-level teams.
 * - **Members** sync as a **set**: adds and removes against the link's snapshot, never a blind replace.
 *   A lead (or the team's manager agent) ↔ `isManager`. Members either side cannot map (no MEMBER/AGENT
 *   link) are kept on the Ever Works side and skipped on the Gauzy side. Agent membership is owned by
 *   Ever Works (agents are one way).
 * - **Resources:** `team.resource.*` for a linked work or task adds or removes the team on the project
 *   or task (`project.teams`, `task.teams`), which is the record's team scope (owner decision D11).
 * - **Deletes:** a team deleted in Ever Works is archived in Gauzy; a Gauzy team delete is not pushed
 *   (delete policy, plan 03 §C.3).
 * - **First link:** existing teams are paired on the Teams tab (same-name suggestions the admin
 *   confirms); only teams created after the mapping sync without a review.
 */
@Injectable()
export class EverWorksTeamsService implements EverWorksInboundHandler, EverWorksOutboundHandler, EverWorksSyncSweeper {
	readonly aggregateTypes = ['team'] as const;
	readonly entityTypes = [EverWorksLinkType.TEAM] as const;
	readonly sweepIntervalMs = TEAM_SWEEP_MS;
	private readonly logger = new Logger('EverWorksTeams');
	private readonly managerRoles = new Map<ID, ID | null>();

	constructor(
		private readonly dataSource: DataSource,
		private readonly contexts: EverWorksMappingContextService,
		private readonly connections: EverWorksConnectionService,
		private readonly links: EverWorksLinkService,
		private readonly queue: EverWorksOutboundQueue
	) {}

	// ── Teams tab ──────────────────────────────────────────────────────────────────────────────────

	/** `GET /mappings/:id/teams`. */
	async teams(integrationTenantId: ID, organizationId?: ID): Promise<EverWorksTeamsView> {
		const context = await this.contexts.forRequest(integrationTenantId, organizationId);
		return this.view(context, await this.everWorksTeams(context));
	}

	/** `PUT /mappings/:id/teams`: confirms or removes pairs, accepts suggestions, creates on the other side. */
	async decide(integrationTenantId: ID, decision: EverWorksTeamsDecision, organizationId?: ID): Promise<EverWorksTeamsView> {
		const context = await this.contexts.forRequest(integrationTenantId, organizationId);
		// Creating a team writes a record, so it follows the mapping switch and the teams direction like the
		// sync does (pairing only writes links, and stays available while the mapping is being set up).
		const creates = !!decision.createInGauzy?.length || !!decision.createInEverWorks?.length;
		if (creates && !context.isEnabled) throw new BadRequestException('The mapping is disabled; enable it before creating teams.');
		if (decision.createInGauzy?.length && !fromEverWorks(context.directions.teams)) {
			throw new BadRequestException('Teams are not synced from Ever Works for this mapping, so Ever Works teams cannot be created in Gauzy.');
		}
		if (decision.createInEverWorks?.length && !toEverWorks(context.directions.teams)) {
			throw new BadRequestException('Teams are not pushed to Ever Works for this mapping, so Gauzy teams cannot be created in Ever Works.');
		}
		const ewTeams = await this.everWorksTeams(context);
		const byEw = new Map(ewTeams.map((team) => [team.id, team]));
		const pairs = [...(decision.links ?? [])];
		if (decision.acceptSuggestions) {
			const suggested = (await this.view(context, ewTeams)).teams.flatMap((row) =>
				row.suggestion && !row.linkedTeamId ? [{ ewTeamId: row.ewTeamId, teamId: row.suggestion.teamId }] : []
			);
			// A Gauzy team suggested for several Ever Works teams (the same name, e.g. nested teams) is ambiguous:
			// it is left for the admin to pair one by one instead of failing the whole request. An explicit link
			// in the same request wins over a suggestion for either team.
			const timesSuggested = new Map<ID, number>();
			for (const suggestion of suggested) timesSuggested.set(suggestion.teamId, (timesSuggested.get(suggestion.teamId) ?? 0) + 1);
			const claimedEw = new Set(pairs.map((pair) => pair.ewTeamId));
			const claimedGauzy = new Set(pairs.map((pair) => pair.teamId));
			for (const suggestion of suggested) {
				if (timesSuggested.get(suggestion.teamId) !== 1 || claimedEw.has(suggestion.ewTeamId) || claimedGauzy.has(suggestion.teamId)) continue;
				pairs.push(suggestion);
			}
		}
		const gauzyIds = [...pairs.map((pair) => pair.teamId), ...(decision.createInEverWorks ?? [])];
		const gauzyTeams = new Map((await this.gauzyTeams(context, gauzyIds)).map((team) => [team.id as ID, team]));
		const seenEw = new Set<string>();
		const seenGauzy = new Set<string>();
		for (const pair of pairs) {
			if (!byEw.has(pair.ewTeamId)) throw new BadRequestException(`${pair.ewTeamId} is not a team of the mapped Ever Works organization.`);
			if (!gauzyTeams.has(pair.teamId)) throw new BadRequestException(`${pair.teamId} is not an active team of this organization.`);
			if (seenEw.has(pair.ewTeamId) || seenGauzy.has(pair.teamId)) throw new BadRequestException('Each team can be paired once.');
			seenEw.add(pair.ewTeamId);
			seenGauzy.add(pair.teamId);
		}
		for (const ewTeamId of decision.createInGauzy ?? []) {
			if (!byEw.has(ewTeamId)) throw new BadRequestException(`${ewTeamId} is not a team of the mapped Ever Works organization.`);
		}
		for (const teamId of decision.createInEverWorks ?? []) {
			if (!gauzyTeams.has(teamId)) throw new BadRequestException(`${teamId} is not an active team of this organization.`);
		}
		for (const ewTeamId of decision.unlinks ?? []) {
			// Kept as `unlinked`, not deleted: the admin's decision is durable, so a later edit of a team
			// created after the mapping never pairs it (or creates it in Ever Works) again on its own.
			const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.TEAM, ewTeamId);
			if (link) await this.links.unlink(link, 'unpaired on the Teams tab');
		}
		for (const pair of pairs) {
			// A pairing replaces the previous one of either side; neither team is changed now.
			for (const stale of [
				await this.links.byEw(context.integrationTenantId, EverWorksLinkType.TEAM, pair.ewTeamId),
				await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.TEAM, pair.teamId)
			]) {
				if (stale) await this.links.remove(stale);
			}
			const team = gauzyTeams.get(pair.teamId) as OrganizationTeam;
			const ewTeam = byEw.get(pair.ewTeamId) as EverWorksTeam;
			await this.record(context, pair.teamId, ewTeam, ewTeam.version ?? null, {
				name: team.name,
				emoji: team.emoji ?? null,
				members: await this.currentMembers(pair.teamId)
			}, 'inbound');
		}
		// The sync writes these, so nothing they change is captured as a Gauzy change (loop guard 1).
		await EverWorksSyncContext.run({ connectionId: context.connection.id as ID, eventId: `teams-tab:${context.integrationTenantId}` }, async () => {
			for (const ewTeamId of decision.createInGauzy ?? []) {
				if (await this.livePairOf(await this.links.byEw(context.integrationTenantId, EverWorksLinkType.TEAM, ewTeamId))) continue;
				await this.applyTeam(context, null, byEw.get(ewTeamId) as EverWorksTeam, null, true);
			}
		});
		const client = this.client(context);
		for (const teamId of decision.createInEverWorks ?? []) {
			if (await this.livePairOf(await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.TEAM, teamId))) continue;
			await this.createInEverWorks(context, client, gauzyTeams.get(teamId) as OrganizationTeam);
		}
		return this.view(context, await this.everWorksTeams(context));
	}

	// ── EW → G ─────────────────────────────────────────────────────────────────────────────────────

	/** Inbound handler: `team.created/updated/deleted`, `team.member.*`, `team.resource.*`. */
	async apply(envelope: EverWorksEventEnvelope, applyContext: EverWorksApplyContext): Promise<EverWorksApplyOutcome> {
		const context = envelope.organizationId ? await this.contexts.forEverWorksOrganization(applyContext.connection, envelope.organizationId) : null;
		if (!context) return { status: 'skipped', message: 'no mapping for the Ever Works organization' };
		if (!context.isEnabled) return { status: 'skipped', message: 'the mapping is disabled' };
		if (!fromEverWorks(context.directions.teams)) return { status: 'skipped', message: 'teams are not synced from Ever Works' };
		const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.TEAM, envelope.aggregate.id);
		if (link?.state === EverWorksLinkState.UNLINKED) return { status: 'skipped', message: 'the team is no longer synced' };
		const version = envelope.aggregate.version ?? null;
		const data = (envelope.data ?? {}) as Record<string, unknown>;
		// A child event carries only its child: an older one can still hold a change a newer one does not, so it is
		// skipped only by its own child's version (or a full team state at least as new), never by the team's (review F75).
		const child = childKeyOf(envelope.type, data);
		if (link && version != null && (child ? childApplied(link, this.everWorksOnly(link), child, version) : link.ewVersion != null && version <= link.ewVersion)) {
			return { status: 'skipped', message: 'already applied (version)' };
		}
		switch (envelope.type) {
			case 'team.created':
			case 'team.updated':
				return this.applyTeam(context, link, { ...(data as unknown as EverWorksTeam), id: envelope.aggregate.id }, version, envelope.type === 'team.created');
			case 'team.deleted':
				return this.archive(context, link);
			case 'team.member.added':
			case 'team.member.updated':
			case 'team.member.removed':
				return this.applyMember(context, link, data as unknown as EverWorksTeamMemberRef & { deleted?: boolean }, envelope.type === 'team.member.removed', version);
			case 'team.resource.added':
			case 'team.resource.removed':
				return this.applyResource(context, link, data as unknown as EverWorksTeamResourceRef, envelope.type === 'team.resource.removed', version);
			default:
				return { status: 'skipped', message: `${envelope.type} is not synced` };
		}
	}

	private async applyTeam(
		context: EverWorksMappingContext,
		link: EverWorksEntityLink | null,
		team: EverWorksTeam,
		version: number | null,
		created: boolean
	): Promise<EverWorksApplyOutcome> {
		// Existing teams are paired on the Teams tab first; only a team created after the mapping arrives unreviewed.
		if (!link && !created) return { status: 'skipped', message: 'not linked yet: pair it on the Teams tab' };
		const before = this.links.snapshot<TeamSnapshot>(link);
		const ewBefore = this.everWorksOnly(link);
		const emoji = emojiOf(team.avatarIcon);
		const iconChanged = !link || (team.avatarIcon ?? null) !== (ewBefore.avatarIcon ?? null);
		let teamId = link?.gauzyId as ID | undefined;
		const repository = this.dataSource.getRepository(OrganizationTeam);
		if (!teamId) {
			const row = await repository.save(
				repository.create({ name: team.name, emoji: emoji ?? undefined, tenantId: context.tenantId, organizationId: context.organizationId, public: false } as never)
			);
			teamId = (row as unknown as OrganizationTeam).id as ID;
			this.logger.log(`Ever Works team ${team.id} created as Gauzy team ${teamId} (organization ${context.organizationId}).`);
		} else {
			const row = await repository.findOne({ where: { id: teamId, tenantId: context.tenantId } as never, withDeleted: true });
			if (!row) return { status: 'skipped', message: 'the Gauzy team is gone' };
			const changes: Record<string, unknown> = {};
			if (team.name && team.name !== before.name) changes['name'] = team.name;
			// Only a changed Ever Works icon is written (lossy fields never flap).
			if (iconChanged && emoji !== (before.emoji ?? null)) changes['emoji'] = emoji;
			if (Object.keys(changes).length) await repository.update({ id: teamId } as never, changes as never);
		}
		const members = team.members ?? ewBefore.members ?? [];
		const applied = await this.applyMemberSet(context, teamId, before.members ?? [], {
			previous: ewBefore.members ?? [],
			next: members,
			previousManagerAgentId: ewBefore.managerAgentId ?? null,
			nextManagerAgentId: team.managerAgentId ?? null,
			previouslyUnmapped: ewBefore.unmapped ?? []
		});
		await this.record(
			context,
			teamId,
			{ ...team, members, resources: team.resources ?? ewBefore.resources ?? [] },
			version ?? team.version ?? null,
			// The snapshot moves only by what was applied here: a Gauzy edit not pushed yet stays a difference.
			{ name: team.name || before.name || '', emoji: iconChanged ? emoji : (before.emoji ?? null), members: applied.members },
			'inbound',
			applied.unmapped
		);
		return { status: 'applied' };
	}

	/**
	 * Ever Works' member set moved from `previous` to `next`: the same adds, removes and lead changes in
	 * Gauzy. Members Ever Works has that Gauzy could not map at the last sync are tried again (a person
	 * paired since then joins). Returns the Gauzy side of the snapshot advanced by exactly what was applied,
	 * and the members still unmapped.
	 */
	private async applyMemberSet(
		context: EverWorksMappingContext,
		teamId: ID,
		snapshotMembers: Array<{ employeeId: ID; isManager: boolean }>,
		change: {
			previous: EverWorksTeamMemberRef[];
			next: EverWorksTeamMemberRef[];
			previousManagerAgentId: string | null;
			nextManagerAgentId: string | null;
			previouslyUnmapped: string[];
		}
	): Promise<{ members: Array<{ employeeId: ID; isManager: boolean }>; unmapped: string[] }> {
		const before = new Map(change.previous.map((ref) => [key(ref), ref]));
		const after = new Map(change.next.map((ref) => [key(ref), ref]));
		const retry = new Set(change.previouslyUnmapped);
		// The old member is judged by the old manager agent, the new one by the new (a manager hand-over).
		const leadBefore = (ref: EverWorksTeamMemberRef) => ref.role === 'lead' || (ref.memberType === 'agent' && ref.memberId === change.previousManagerAgentId);
		const leadAfter = (ref: EverWorksTeamMemberRef) => ref.role === 'lead' || (ref.memberType === 'agent' && ref.memberId === change.nextManagerAgentId);
		const snapshot = new Map(snapshotMembers.map((m) => [m.employeeId, m.isManager]));
		const unmapped: string[] = [];
		for (const ref of after.values()) {
			const was = before.get(key(ref));
			const unchanged = !!was && leadBefore(was) === leadAfter(ref) && !retry.has(key(ref));
			const employeeId = await this.employeeFor(context, ref);
			if (!employeeId) {
				unmapped.push(key(ref));
				continue;
			}
			if (unchanged) continue;
			await this.upsertMembership(context, teamId, employeeId, leadAfter(ref));
			snapshot.set(employeeId, leadAfter(ref));
		}
		for (const ref of before.values()) {
			if (after.has(key(ref))) continue;
			const employeeId = await this.employeeFor(context, ref);
			if (!employeeId) continue;
			await this.dataSource.getRepository(OrganizationTeamEmployee).delete({ organizationTeamId: teamId, employeeId } as never);
			snapshot.delete(employeeId);
		}
		return {
			members: [...snapshot.entries()].map(([employeeId, isManager]) => ({ employeeId, isManager })).sort((a, b) => String(a.employeeId).localeCompare(String(b.employeeId))),
			unmapped
		};
	}

	private async applyMember(
		context: EverWorksMappingContext,
		link: EverWorksEntityLink | null,
		member: EverWorksTeamMemberRef & { deleted?: boolean },
		removed: boolean,
		version: number | null
	): Promise<EverWorksApplyOutcome> {
		if (!link) return { status: 'skipped', message: 'the team is not linked' };
		if (!(await this.teamExists(context, link))) return this.teamGone(link);
		const ew = this.everWorksOnly(link);
		const snapshot = this.links.snapshot<TeamSnapshot>(link);
		const previous = ew.members ?? [];
		const next = previous.filter((ref) => key(ref) !== key(member));
		if (!removed && !member.deleted) next.push({ memberType: member.memberType, memberId: member.memberId, role: member.role });
		const applied = await this.applyMemberSet(context, link.gauzyId as ID, snapshot.members ?? [], {
			previous,
			next,
			previousManagerAgentId: ew.managerAgentId ?? null,
			nextManagerAgentId: ew.managerAgentId ?? null,
			previouslyUnmapped: ew.unmapped ?? []
		});
		await this.record(
			context,
			link.gauzyId as ID,
			{ ...this.teamFrom(link), members: next },
			childRecordVersion(link, version),
			{ name: snapshot.name ?? '', emoji: snapshot.emoji ?? null, members: applied.members },
			'inbound',
			applied.unmapped,
			childStateAfter(link, ew, `m:${key(member)}`, version)
		);
		return { status: 'applied' };
	}

	private async applyResource(
		context: EverWorksMappingContext,
		link: EverWorksEntityLink | null,
		resource: EverWorksTeamResourceRef,
		removed: boolean,
		version: number | null
	): Promise<EverWorksApplyOutcome> {
		if (!link) return { status: 'skipped', message: 'the team is not linked' };
		if (!(await this.teamExists(context, link))) return this.teamGone(link);
		const ew = this.everWorksOnly(link);
		const resources = (ew.resources ?? []).filter((r) => !(r.resourceType === resource.resourceType && r.resourceId === resource.resourceId));
		if (!removed) resources.push({ resourceType: resource.resourceType, resourceId: resource.resourceId });
		// Works and tasks carry the team as their scope in Gauzy; other types (agents, goals, …) are not synced here.
		const target =
			resource.resourceType === 'work'
				? { linkType: EverWorksLinkType.PROJECT_WORK, entity: OrganizationProject }
				: resource.resourceType === 'task'
					? { linkType: EverWorksLinkType.TASK, entity: Task }
					: null;
		let message: string | undefined;
		if (target) {
			const recordLink = await this.links.byEw(context.integrationTenantId, target.linkType, resource.resourceId);
			if (!recordLink) message = `the ${resource.resourceType} is not linked yet; its own sync carries its teams`;
			// Only a pair that syncs: a work or task that turned private (unlinked) or whose Gauzy record is gone never
			// has its team scope changed from here (review F78, F76).
			else if (recordLink.state !== EverWorksLinkState.OK) message = `the ${resource.resourceType} is no longer synced`;
			else if (!(await this.dataSource.getRepository(target.entity).findOne({ where: { id: recordLink.gauzyId } as never, withDeleted: true, select: { id: true } as never })))
				message = `the Gauzy ${resource.resourceType === 'work' ? 'project' : 'task'} is gone`;
			else await this.setTeam(target.entity, recordLink.gauzyId as ID, link.gauzyId as ID, !removed);
		}
		const snapshot = this.links.snapshot<TeamSnapshot>(link);
		await this.record(
			context,
			link.gauzyId as ID,
			{ ...this.teamFrom(link), resources },
			childRecordVersion(link, version),
			{ name: snapshot.name ?? '', emoji: snapshot.emoji ?? null, members: snapshot.members ?? [] },
			'inbound',
			undefined,
			childStateAfter(link, ew, `r:${resource.resourceType}:${resource.resourceId}`, version)
		);
		return { status: 'applied', ...(message ? { message } : {}) };
	}

	/** A team deleted in Ever Works is archived in Gauzy (never deleted) and its link stops syncing. */
	private async archive(context: EverWorksMappingContext, link: EverWorksEntityLink | null): Promise<EverWorksApplyOutcome> {
		if (!link) return { status: 'skipped', message: 'the team is not linked' };
		await this.dataSource
			.getRepository(OrganizationTeam)
			.update({ id: link.gauzyId, tenantId: context.tenantId } as never, { isActive: false, isArchived: true, archivedAt: new Date() } as never);
		await this.links.unlink(link, 'deleted in Ever Works; the Gauzy team is archived');
		return { status: 'applied' };
	}

	// ── G → EW ─────────────────────────────────────────────────────────────────────────────────────

	/** Outbound handler: a Gauzy team (or its member set) changed. */
	async push(change: EverWorksOutboundChange, pushContext: EverWorksPushContext): Promise<EverWorksPushOutcome> {
		const context = await this.contexts.forOrganization(change.tenantId as ID, change.organizationId as ID);
		if (!context || context.integrationTenantId !== pushContext.mapping.id) return { status: 'skipped', message: 'no mapping for the organization' };
		if (!context.isEnabled) return { status: 'skipped', message: 'the mapping is disabled' };
		if (!toEverWorks(context.directions.teams)) return { status: 'skipped', message: 'teams are not pushed to Ever Works' };
		const link = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.TEAM, change.gauzyId as ID);
		if (link?.state === EverWorksLinkState.UNLINKED) return { status: 'skipped', message: 'the team is no longer synced' };
		const team = await this.dataSource
			.getRepository(OrganizationTeam)
			.findOne({ where: { id: change.gauzyId, tenantId: context.tenantId } as never, withDeleted: true });
		if (change.op === 'delete' || !team || (team as { deletedAt?: Date | null }).deletedAt || team.isArchived) {
			this.logger.log(`Team ${change.gauzyId}: Gauzy team deletes are not pushed to Ever Works (delete policy).`);
			return { status: 'skipped', message: 'team deletes are not pushed to Ever Works (delete policy)' };
		}
		const client = this.client(context);
		if (!link) {
			if (!this.createdAfterMapping(team, context)) return { status: 'skipped', message: 'not linked yet: pair it on the Teams tab' };
			await this.createInEverWorks(context, client, team);
			return { status: 'pushed', message: 'created in Ever Works' };
		}
		return this.update(context, client, team, link);
	}

	private async update(context: EverWorksMappingContext, client: EverWorksClient, team: OrganizationTeam, link: EverWorksEntityLink): Promise<EverWorksPushOutcome> {
		let row = team;
		let pair = link;
		for (let attempt = 0; attempt < 2; attempt++) {
			const before = this.links.snapshot<TeamSnapshot>(pair);
			const ewTeamId = pair.ewId;
			const nowMembers = await this.currentMembers(row.id as ID);
			const emoji = row.emoji ?? null;
			let ew = this.everWorksOnly(pair);
			let version = pair.ewVersion ?? undefined;
			try {
				const patch: Record<string, unknown> = {};
				if (row.name !== before.name) patch['name'] = row.name;
				if (emoji !== (before.emoji ?? null)) patch['avatarIcon'] = emoji;
				const merged = await this.mergedMembers(context, before.members ?? [], nowMembers, ew.members ?? []);
				if (!Object.keys(patch).length && !merged.changed) {
					// Nothing to send. Members only Gauzy has (no person link) may still differ from the snapshot:
					// record them, so the drift sweep does not queue this team again.
					if (!sameMembers(before.members ?? [], nowMembers)) {
						await this.record(context, row.id as ID, { ...this.teamFrom(pair), id: ewTeamId }, pair.ewVersion ?? null, {
							name: before.name ?? row.name,
							emoji: before.emoji ?? null,
							members: nowMembers
						}, 'outbound', undefined, childStateOf(ew));
					}
					return { status: 'skipped', message: 'nothing changed' };
				}
				if (Object.keys(patch).length) {
					const updated = await client.request<EverWorksTeam>('PATCH', `/teams/${encodeURIComponent(ewTeamId)}`, { body: patch, ifMatchVersion: version });
					version = updated?.version ?? version;
				}
				if (merged.changed) {
					const updated = await client.request<EverWorksTeam>('PUT', `/teams/${encodeURIComponent(ewTeamId)}/members`, {
						body: { members: merged.members },
						ifMatchVersion: version
					});
					version = updated?.version ?? version;
					ew = { ...ew, members: updated?.members ?? merged.members };
				}
				// Ever Works' answer is not applied to Gauzy as a full team state: the child events since the last one applied
				// still apply by child, so the child history is kept (#11076 review).
				await this.record(context, row.id as ID, { ...this.teamFrom(pair), ...ew, id: ewTeamId, name: row.name, avatarIcon: emoji }, version ?? null, {
					name: row.name,
					emoji,
					members: nowMembers
				}, 'outbound', undefined, childStateAfterPush(pair, this.everWorksOnly(pair)));
				return { status: 'pushed' };
			} catch (error) {
				if (!(error instanceof EverWorksApiError && error.status === 412) || attempt === 1) throw error;
				// 412: Ever Works moved on. When teams sync from Ever Works, its newer state is applied to Gauzy
				// first (as the sync, so it is not captured back), then this push is merged again on top of it:
				// no remote change is skipped by the version that gets recorded (plan 03 §C.3).
				const remote = await client.request<EverWorksTeam>('GET', `/teams/${encodeURIComponent(ewTeamId)}`);
				if (fromEverWorks(context.directions.teams)) {
					await EverWorksSyncContext.run({ connectionId: context.connection.id as ID, eventId: `team-412:${ewTeamId}` }, () =>
						this.applyTeam(context, pair, { ...remote, id: ewTeamId }, remote.version ?? null, false)
					);
				} else {
					// One way (Gauzy → Ever Works): nothing is written to Gauzy. Only Ever Works' newer state and
					// version are recorded, with the Gauzy snapshot unchanged, so the retry merges the Gauzy
					// changes since the last sync on top of Ever Works' current team.
					await this.record(
						context,
						row.id as ID,
						{ ...remote, id: ewTeamId, members: remote.members ?? ew.members ?? [], resources: remote.resources ?? ew.resources ?? [] },
						remote.version ?? null,
						{ name: before.name ?? row.name, emoji: before.emoji ?? null, members: before.members ?? [] },
						'outbound',
						ew.unmapped ?? []
					);
				}
				const freshLink = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.TEAM, row.id as ID);
				const freshTeam = await this.dataSource
					.getRepository(OrganizationTeam)
					.findOne({ where: { id: row.id, tenantId: context.tenantId } as never, withDeleted: true });
				if (!freshLink || !freshTeam) return { status: 'skipped', message: 'the team changed during the push' };
				pair = freshLink;
				row = freshTeam;
			}
		}
		throw new Error('unreachable');
	}

	/**
	 * Gauzy's member set moved from the snapshot to `now`: the same adds, removes and lead changes applied
	 * to Ever Works' current set (members Gauzy cannot map, and agents, are left as they are).
	 */
	private async mergedMembers(
		context: EverWorksMappingContext,
		snapshot: Array<{ employeeId: ID; isManager: boolean }>,
		now: Array<{ employeeId: ID; isManager: boolean }>,
		everWorks: EverWorksTeamMemberRef[]
	): Promise<{ members: EverWorksTeamMemberRef[]; changed: boolean }> {
		const before = new Map(snapshot.map((m) => [m.employeeId, m.isManager]));
		const after = new Map(now.map((m) => [m.employeeId, m.isManager]));
		const result = new Map(everWorks.map((ref) => [key(ref), ref]));
		let changed = false;
		for (const [employeeId, isManager] of after) {
			if (before.has(employeeId) && before.get(employeeId) === isManager) continue;
			const ref = await this.refFor(context, employeeId);
			if (!ref || ref.memberType === 'agent') continue;
			const role: EverWorksTeamMemberRef['role'] = isManager ? 'lead' : 'member';
			if (result.get(key(ref))?.role === role) continue;
			result.set(key(ref), { ...ref, role });
			changed = true;
		}
		for (const employeeId of before.keys()) {
			if (after.has(employeeId)) continue;
			const ref = await this.refFor(context, employeeId);
			if (!ref || ref.memberType === 'agent') continue;
			if (result.delete(key(ref))) changed = true;
		}
		return { members: [...result.values()], changed };
	}

	/** Creates a Gauzy team in Ever Works (top level), with its mapped people, and links the pair. */
	private async createInEverWorks(context: EverWorksMappingContext, client: EverWorksClient, team: OrganizationTeam): Promise<void> {
		const connectionId = context.connection.id as ID;
		const emoji = team.emoji ?? null;
		const created = await client.request<EverWorksTeam>('POST', '/teams', {
			body: {
				name: team.name,
				...(emoji ? { avatarIcon: emoji } : {}),
				externalRef: { source: EVER_WORKS_LINK_SOURCE, installationId: connectionId, externalId: team.id }
			},
			idempotencyKey: createHash('sha256').update(`${connectionId}:${EverWorksLinkType.TEAM}:${team.id}:create`).digest('hex')
		});
		let version = created.version ?? null;
		let members = created.members ?? [];
		const now = await this.currentMembers(team.id as ID);
		const merged = await this.mergedMembers(context, [], now, members);
		if (merged.changed) {
			const updated = await client.request<EverWorksTeam>('PUT', `/teams/${encodeURIComponent(created.id)}/members`, {
				body: { members: merged.members },
				...(version != null ? { ifMatchVersion: version } : {})
			});
			version = updated?.version ?? version;
			members = updated?.members ?? merged.members;
		}
		await this.record(context, team.id as ID, { ...created, members }, version, { name: team.name, emoji, members: now }, 'outbound');
		this.logger.log(`Gauzy team ${team.id} created in Ever Works as ${created.id}.`);
	}

	// ── Sweep ──────────────────────────────────────────────────────────────────────────────────────

	/**
	 * The membership sweep (plan 03 §C.2, the durable backstop), run by the sync loop for a connection it
	 * holds: (1) Ever Works members Gauzy could not map join once their person is paired; (2) a Gauzy
	 * member set that drifted from the snapshot without a captured change (a bulk delete the ORM hooks
	 * cannot see) queues the team's push.
	 */
	async sweep(connection: EverWorksConnection): Promise<void> {
		for (const context of await this.contextsOf(connection)) {
			if (!context.isEnabled) continue;
			const links = (await this.links.list(context.integrationTenantId, EverWorksLinkType.TEAM)).filter((link) => link.state === EverWorksLinkState.OK);
			for (const link of links) {
				// One link never stops the sweep of the others (review F76).
				await this.sweepLink(connection, context, link).catch((error) =>
					this.logger.warn(`Team link ${link.id}: the membership sweep failed (${error instanceof Error ? error.message : 'error'}).`)
				);
			}
		}
	}

	/** The sweep of one team link (see {@link sweep}). */
	private async sweepLink(connection: EverWorksConnection, context: EverWorksMappingContext, link: EverWorksEntityLink): Promise<void> {
		// A Gauzy team deleted (hard) in Gauzy: the pair stops syncing, instead of failing (and re-queueing) each sweep.
		if (!(await this.teamExists(context, link))) {
			await this.teamGone(link);
			return;
		}
		const ew = this.everWorksOnly(link);
		if (fromEverWorks(context.directions.teams) && ew.unmapped?.length) {
			await EverWorksSyncContext.run({ connectionId: connection.id as ID, eventId: `team-sweep:${link.ewId}` }, async () => {
				const snapshot = this.links.snapshot<TeamSnapshot>(link);
				const applied = await this.applyMemberSet(context, link.gauzyId as ID, snapshot.members ?? [], {
					previous: ew.members ?? [],
					next: ew.members ?? [],
					previousManagerAgentId: ew.managerAgentId ?? null,
					nextManagerAgentId: ew.managerAgentId ?? null,
					previouslyUnmapped: ew.unmapped ?? []
				});
				// Nothing to record only when the unmapped set and the Gauzy side are both unchanged (equal
				// counts can hide one member becoming mapped while another becomes unmapped).
				const previouslyUnmapped = new Set(ew.unmapped ?? []);
				const sameUnmapped = applied.unmapped.length === previouslyUnmapped.size && applied.unmapped.every((k) => previouslyUnmapped.has(k));
				if (sameUnmapped && sameMembers(snapshot.members ?? [], applied.members)) return;
				await this.record(context, link.gauzyId as ID, { ...this.teamFrom(link) }, link.ewVersion ?? null, {
					name: snapshot.name ?? '',
					emoji: snapshot.emoji ?? null,
					members: applied.members
				}, 'inbound', applied.unmapped, childStateOf(ew));
			});
		}
		if (toEverWorks(context.directions.teams)) {
			const fresh = (await this.links.byEw(context.integrationTenantId, EverWorksLinkType.TEAM, link.ewId)) ?? link;
			const snapshot = this.links.snapshot<TeamSnapshot>(fresh);
			if (!sameMembers(snapshot.members ?? [], await this.currentMembers(link.gauzyId as ID))) {
				await this.queue.enqueue({
					tenantId: context.tenantId,
					organizationId: context.organizationId,
					entityType: EverWorksLinkType.TEAM,
					gauzyId: link.gauzyId as ID,
					op: 'upsert'
				});
			}
		}
	}

	/** Whether the Gauzy team of a link still exists (a soft-deleted one counts; a hard-deleted one does not). */
	private async teamExists(context: EverWorksMappingContext, link: EverWorksEntityLink): Promise<boolean> {
		const row = await this.dataSource
			.getRepository(OrganizationTeam)
			.findOne({ where: { id: link.gauzyId, tenantId: context.tenantId } as never, withDeleted: true, select: { id: true } as never });
		return !!row;
	}

	/** A pair whose Gauzy team was deleted in Gauzy stops syncing (the Teams tab can pair the Ever Works team again). */
	private async teamGone(link: EverWorksEntityLink): Promise<EverWorksApplyOutcome> {
		await this.links.unlink(link, 'the Gauzy team was deleted; the pair no longer syncs');
		return { status: 'skipped', message: 'the Gauzy team is gone' };
	}

	/** The mappings that sync through a connection. */
	private async contextsOf(connection: EverWorksConnection): Promise<EverWorksMappingContext[]> {
		const mappings = await this.dataSource.getRepository(IntegrationTenant).find({
			where: { tenantId: connection.tenantId, isActive: true, isArchived: false } as never,
			relations: { settings: true } as never
		});
		const contexts: EverWorksMappingContext[] = [];
		for (const mapping of mappings) {
			const viaThis = mapping.settings?.some((s) => s.settingsName === EverWorksSettingName.CONNECTION_ID && s.settingsValue === connection.id);
			if (!viaThis || !mapping.organizationId) continue;
			const context = await this.contexts.forOrganization(connection.tenantId as ID, mapping.organizationId as ID);
			if (context && context.connection.id === connection.id) contexts.push(context);
		}
		return contexts;
	}

	/**
	 * Whether a link is a live pairing. An `unlinked` row (a pair the admin undid, or a team deleted in Ever
	 * Works) gives way to an explicit "create on the other side" from the Teams tab.
	 */
	private async livePairOf(link: EverWorksEntityLink | null): Promise<boolean> {
		if (!link) return false;
		if (link.state !== EverWorksLinkState.UNLINKED) return true;
		await this.links.remove(link);
		return false;
	}

	// ── Shared ─────────────────────────────────────────────────────────────────────────────────────

	private async record(
		context: EverWorksMappingContext,
		teamId: ID,
		team: EverWorksTeam,
		version: number | null,
		snapshot: TeamSnapshot,
		direction: 'inbound' | 'outbound',
		unmapped: string[] = (team as { unmapped?: string[] }).unmapped ?? [],
		// Absent: a full team state is recorded, and the link's version is the floor of the child events (review F75).
		childState: TeamChildState = {}
	): Promise<void> {
		const ewOnly: TeamEverWorksOnly = {
			slug: team.slug,
			description: team.description ?? null,
			parentTeamId: team.parentTeamId ?? null,
			managerAgentId: team.managerAgentId ?? null,
			avatarIcon: team.avatarIcon ?? null,
			members: team.members ?? [],
			resources: team.resources ?? [],
			unmapped,
			...childState
		};
		await this.links.record({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			entityType: EverWorksLinkType.TEAM,
			gauzyId: teamId,
			ewId: team.id,
			ewVersion: version,
			ewUpdatedAt: team.updatedAt ?? null,
			snapshot: snapshot as unknown as Record<string, unknown>,
			ewOnly: ewOnly as unknown as Record<string, unknown>,
			direction
		});
	}

	private everWorksOnly(link: EverWorksEntityLink | null | undefined): TeamEverWorksOnly {
		if (!link?.ewOnly) return {};
		try {
			return JSON.parse(link.ewOnly) as TeamEverWorksOnly;
		} catch {
			return {};
		}
	}

	/** The Ever Works side of a linked team, as last synced. */
	private teamFrom(link: EverWorksEntityLink): EverWorksTeam {
		const ew = this.everWorksOnly(link);
		return { id: link.ewId, name: this.links.snapshot<TeamSnapshot>(link).name ?? '', ...ew };
	}

	/** The Gauzy employee of an Ever Works member (a linked person or agent), or `null`. */
	private async employeeFor(context: EverWorksMappingContext, ref: Pick<EverWorksTeamMemberRef, 'memberType' | 'memberId'>): Promise<ID | null> {
		const type = ref.memberType === 'agent' ? EverWorksLinkType.AGENT : EverWorksLinkType.MEMBER;
		const link = await this.links.byEw(context.integrationTenantId, type, ref.memberId);
		return link && link.state !== EverWorksLinkState.UNLINKED ? (link.gauzyId as ID) : null;
	}

	/** The Ever Works member of a Gauzy employee (a linked person or agent), or `null`. */
	private async refFor(context: EverWorksMappingContext, employeeId: ID): Promise<Omit<EverWorksTeamMemberRef, 'role'> | null> {
		const person = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.MEMBER, employeeId);
		if (person && person.state !== EverWorksLinkState.UNLINKED) return { memberType: 'user', memberId: person.ewId };
		const agent = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.AGENT, employeeId);
		if (agent && agent.state !== EverWorksLinkState.UNLINKED) return { memberType: 'agent', memberId: agent.ewId };
		return null;
	}

	/**
	 * Adds or updates a membership. A manager is marked the way the platform marks one — the tenant's
	 * `MANAGER` role on the membership — and `isManager` as well, so every reader of either agrees.
	 */
	private async upsertMembership(context: EverWorksMappingContext, teamId: ID, employeeId: ID, isManager: boolean): Promise<void> {
		const repository = this.dataSource.getRepository(OrganizationTeamEmployee);
		const roleId = isManager ? await this.managerRoleId(context.tenantId) : null;
		const existing = await repository.findOne({ where: { organizationTeamId: teamId, employeeId } as never, relations: { role: true } as never });
		if (existing) {
			if (isManagerMember(existing) !== isManager) await repository.update({ id: existing.id } as never, { isManager, roleId } as never);
			return;
		}
		await repository.save(
			repository.create({ tenantId: context.tenantId, organizationId: context.organizationId, organizationTeamId: teamId, employeeId, isManager, roleId } as never)
		);
	}

	/** The tenant's `MANAGER` role (cached per tenant), or `null` when the tenant has none. */
	private async managerRoleId(tenantId: ID): Promise<ID | null> {
		if (!this.managerRoles.has(tenantId)) {
			const role = await this.dataSource.getRepository(Role).findOne({ where: { name: RolesEnum.MANAGER, tenantId } as never });
			this.managerRoles.set(tenantId, (role?.id as ID) ?? null);
		}
		return this.managerRoles.get(tenantId) ?? null;
	}

	/** Gauzy's members of a team; a manager is `isManager` or holds the `MANAGER` role (the platform's own rule). */
	private async currentMembers(teamId: ID): Promise<Array<{ employeeId: ID; isManager: boolean }>> {
		const rows = await this.dataSource
			.getRepository(OrganizationTeamEmployee)
			.find({ where: { organizationTeamId: teamId } as never, relations: { role: true } as never });
		return rows
			.map((row) => ({ employeeId: row.employeeId as ID, isManager: isManagerMember(row) }))
			.sort((a, b) => String(a.employeeId).localeCompare(String(b.employeeId)));
	}

	/** Adds or removes a team on a project or task (its team scope). */
	private async setTeam(entity: typeof OrganizationProject | typeof Task, recordId: ID, teamId: ID, attached: boolean): Promise<void> {
		const relation = this.dataSource.createQueryBuilder().relation(entity, 'teams').of(recordId);
		const current = (await relation.loadMany()) as Array<{ id: ID }>;
		const has = current.some((team) => team.id === teamId);
		if (attached && !has) await relation.add(teamId);
		if (!attached && has) await relation.remove(teamId);
	}

	private createdAfterMapping(team: OrganizationTeam, context: EverWorksMappingContext): boolean {
		const created = (team as { createdAt?: Date }).createdAt;
		const mapped = (context.mapping as { createdAt?: Date }).createdAt;
		return !!created && !!mapped && new Date(created).getTime() >= new Date(mapped).getTime();
	}

	private client(context: EverWorksMappingContext): EverWorksClient {
		return this.connections.client(context.connection, context.everWorksOrganizationSlug);
	}

	private async everWorksTeams(context: EverWorksMappingContext): Promise<EverWorksTeam[]> {
		const client = this.client(context);
		const teams: EverWorksTeam[] = [];
		let cursor: string | null = null;
		for (let page = 0; page < 100; page++) {
			const result: EverWorksListPage<EverWorksTeam> = await client.request('GET', '/teams', { query: { limit: 500, cursor } });
			teams.push(...(result.data ?? []));
			if (!result.hasMore || !result.nextCursor) break;
			cursor = result.nextCursor;
		}
		return teams.filter((team) => !team.deleted);
	}

	private async gauzyTeams(context: EverWorksMappingContext, only?: ID[]): Promise<OrganizationTeam[]> {
		if (only && !only.length) return [];
		return this.dataSource.getRepository(OrganizationTeam).find({
			where: { tenantId: context.tenantId, organizationId: context.organizationId, isArchived: false, ...(only ? { id: In(only) } : {}) } as never
		});
	}

	private async view(context: EverWorksMappingContext, ewTeams: EverWorksTeam[]): Promise<EverWorksTeamsView> {
		const links = (await this.links.list(context.integrationTenantId, EverWorksLinkType.TEAM)).filter((link) => link.state !== EverWorksLinkState.UNLINKED);
		const linkByEw = new Map(links.map((link) => [link.ewId, link.gauzyId as ID]));
		const linked = new Set(links.map((link) => link.gauzyId as ID));
		const gauzy = await this.gauzyTeams(context);
		const rows: EverWorksTeamRow[] = ewTeams.map((team) => {
			const linkedTeamId = linkByEw.get(team.id) ?? null;
			const match = linkedTeamId ? undefined : gauzy.find((g) => !linked.has(g.id as ID) && sameName(g.name, team.name));
			return {
				ewTeamId: team.id,
				name: team.name,
				slug: team.slug ?? null,
				parentTeamId: team.parentTeamId ?? null,
				linkedTeamId,
				suggestion: match ? { teamId: match.id as ID, reason: 'same_name' } : null
			};
		});
		return {
			teams: rows,
			// A suggestion is not a pairing: a suggested team stays unmatched until the admin confirms it.
			unmatchedTeams: gauzy.filter((g) => !linked.has(g.id as ID)).map((g) => ({ teamId: g.id as ID, name: g.name }))
		};
	}
}
