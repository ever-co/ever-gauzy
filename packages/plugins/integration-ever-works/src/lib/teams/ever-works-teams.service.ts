import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource, In } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { OrganizationProject, OrganizationTeam, OrganizationTeamEmployee, Task } from '@gauzy/core';
import { EverWorksApiError, EverWorksClient } from '../client/ever-works-client';
import type { EverWorksEventEnvelope, EverWorksListPage } from '../client/ever-works-client.types';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import type { EverWorksDirection } from '../mapping/ever-works-mapping.defaults';
import { EverWorksMappingContext, EverWorksMappingContextService } from '../mapping/ever-works-mapping-context.service';
import { EverWorksEntityLink, EverWorksLinkState, EverWorksLinkType, EverWorksOutboundChange } from '../sync/entities/ever-works-sync.entities';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import type { EverWorksApplyContext, EverWorksApplyOutcome, EverWorksInboundHandler } from '../sync/inbound/ever-works-inbound.applier';
import { EverWorksLinkService } from '../sync/links/ever-works-link.service';
import type { EverWorksOutboundHandler, EverWorksPushContext, EverWorksPushOutcome } from '../sync/outbound/ever-works-outbound.pusher';
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
}

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
export class EverWorksTeamsService implements EverWorksInboundHandler, EverWorksOutboundHandler {
	readonly aggregateTypes = ['team'] as const;
	readonly entityTypes = [EverWorksLinkType.TEAM] as const;
	private readonly logger = new Logger('EverWorksTeams');

	constructor(
		private readonly dataSource: DataSource,
		private readonly contexts: EverWorksMappingContextService,
		private readonly connections: EverWorksConnectionService,
		private readonly links: EverWorksLinkService
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
		const ewTeams = await this.everWorksTeams(context);
		const byEw = new Map(ewTeams.map((team) => [team.id, team]));
		const pairs = [...(decision.links ?? [])];
		if (decision.acceptSuggestions) {
			for (const row of (await this.view(context, ewTeams)).teams) {
				if (row.suggestion && !row.linkedTeamId) pairs.push({ ewTeamId: row.ewTeamId, teamId: row.suggestion.teamId });
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
			const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.TEAM, ewTeamId);
			if (link) await this.links.remove(link);
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
				if (await this.links.byEw(context.integrationTenantId, EverWorksLinkType.TEAM, ewTeamId)) continue;
				await this.applyTeam(context, null, byEw.get(ewTeamId) as EverWorksTeam, null, true);
			}
		});
		const client = this.client(context);
		for (const teamId of decision.createInEverWorks ?? []) {
			if (await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.TEAM, teamId)) continue;
			await this.createInEverWorks(context, client, gauzyTeams.get(teamId) as OrganizationTeam);
		}
		return this.view(context, await this.everWorksTeams(context));
	}

	// ── EW → G ─────────────────────────────────────────────────────────────────────────────────────

	/** Inbound handler: `team.created/updated/deleted`, `team.member.*`, `team.resource.*`. */
	async apply(envelope: EverWorksEventEnvelope, applyContext: EverWorksApplyContext): Promise<EverWorksApplyOutcome> {
		const context = envelope.organizationId ? await this.contexts.forEverWorksOrganization(applyContext.connection, envelope.organizationId) : null;
		if (!context) return { status: 'skipped', message: 'no mapping for the Ever Works organization' };
		if (!fromEverWorks(context.directions.teams)) return { status: 'skipped', message: 'teams are not synced from Ever Works' };
		const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.TEAM, envelope.aggregate.id);
		if (link?.state === EverWorksLinkState.UNLINKED) return { status: 'skipped', message: 'the team is no longer synced' };
		const version = envelope.aggregate.version ?? null;
		if (link && link.ewVersion != null && version != null && version <= link.ewVersion) {
			return { status: 'skipped', message: 'already applied (version)' };
		}
		const data = (envelope.data ?? {}) as Record<string, unknown>;
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
			if ((team.avatarIcon ?? null) !== (ewBefore.avatarIcon ?? null) && emoji !== (before.emoji ?? null)) changes['emoji'] = emoji;
			if (Object.keys(changes).length) await repository.update({ id: teamId } as never, changes as never);
		}
		const members = team.members ?? ewBefore.members ?? [];
		await this.applyMemberSet(context, teamId, ewBefore.members ?? [], members, team.managerAgentId ?? null);
		await this.record(
			context,
			teamId,
			{ ...team, members, resources: team.resources ?? ewBefore.resources ?? [] },
			version ?? team.version ?? null,
			{ name: team.name, emoji, members: await this.currentMembers(teamId) },
			'inbound'
		);
		return { status: 'applied' };
	}

	/** Ever Works' member set moved from `previous` to `next`: the same adds and removes in Gauzy. */
	private async applyMemberSet(
		context: EverWorksMappingContext,
		teamId: ID,
		previous: EverWorksTeamMemberRef[],
		next: EverWorksTeamMemberRef[],
		managerAgentId: string | null
	): Promise<void> {
		const before = new Map(previous.map((ref) => [key(ref), ref]));
		const after = new Map(next.map((ref) => [key(ref), ref]));
		const lead = (ref: EverWorksTeamMemberRef) => ref.role === 'lead' || (ref.memberType === 'agent' && ref.memberId === managerAgentId);
		for (const ref of after.values()) {
			const was = before.get(key(ref));
			if (was && lead(was) === lead(ref)) continue;
			const employeeId = await this.employeeFor(context, ref);
			if (employeeId) await this.upsertMembership(context, teamId, employeeId, lead(ref));
		}
		for (const ref of before.values()) {
			if (after.has(key(ref))) continue;
			const employeeId = await this.employeeFor(context, ref);
			if (employeeId) await this.dataSource.getRepository(OrganizationTeamEmployee).delete({ organizationTeamId: teamId, employeeId } as never);
		}
	}

	private async applyMember(
		context: EverWorksMappingContext,
		link: EverWorksEntityLink | null,
		member: EverWorksTeamMemberRef & { deleted?: boolean },
		removed: boolean,
		version: number | null
	): Promise<EverWorksApplyOutcome> {
		if (!link) return { status: 'skipped', message: 'the team is not linked' };
		const ew = this.everWorksOnly(link);
		const previous = ew.members ?? [];
		const next = previous.filter((ref) => key(ref) !== key(member));
		if (!removed && !member.deleted) next.push({ memberType: member.memberType, memberId: member.memberId, role: member.role });
		await this.applyMemberSet(context, link.gauzyId as ID, previous, next, ew.managerAgentId ?? null);
		const snapshot = this.links.snapshot<TeamSnapshot>(link);
		await this.record(
			context,
			link.gauzyId as ID,
			{ ...this.teamFrom(link), members: next },
			version,
			{ name: snapshot.name ?? '', emoji: snapshot.emoji ?? null, members: await this.currentMembers(link.gauzyId as ID) },
			'inbound'
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
			if (recordLink) await this.setTeam(target.entity, recordLink.gauzyId as ID, link.gauzyId as ID, !removed);
			else message = `the ${resource.resourceType} is not linked yet; its own sync carries its teams`;
		}
		const snapshot = this.links.snapshot<TeamSnapshot>(link);
		await this.record(
			context,
			link.gauzyId as ID,
			{ ...this.teamFrom(link), resources },
			version,
			{ name: snapshot.name ?? '', emoji: snapshot.emoji ?? null, members: snapshot.members ?? [] },
			'inbound'
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
		const before = this.links.snapshot<TeamSnapshot>(link);
		const ewTeamId = link.ewId;
		const nowMembers = await this.currentMembers(team.id as ID);
		const emoji = team.emoji ?? null;
		let ew = this.everWorksOnly(link);
		let version = link.ewVersion ?? undefined;
		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				const patch: Record<string, unknown> = {};
				if (team.name !== before.name) patch['name'] = team.name;
				if (emoji !== (before.emoji ?? null)) patch['avatarIcon'] = emoji;
				const merged = await this.mergedMembers(context, before.members ?? [], nowMembers, ew.members ?? []);
				if (!Object.keys(patch).length && !merged.changed) return { status: 'skipped', message: 'nothing changed' };
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
				await this.record(context, team.id as ID, { ...this.teamFrom(link), ...ew, id: ewTeamId, name: team.name, avatarIcon: emoji }, version ?? null, {
					name: team.name,
					emoji,
					members: nowMembers
				}, 'outbound');
				return { status: 'pushed' };
			} catch (error) {
				// 412: Ever Works moved on; read it again and merge once more (plan 03 §C.3).
				if (!(error instanceof EverWorksApiError && error.status === 412) || attempt === 1) throw error;
				const current = await client.request<EverWorksTeam>('GET', `/teams/${encodeURIComponent(ewTeamId)}`);
				version = current.version ?? undefined;
				ew = { ...ew, members: current.members ?? ew.members, resources: current.resources ?? ew.resources };
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
				externalRef: { source: 'ever-gauzy', installationId: connectionId, externalId: team.id }
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

	// ── Shared ─────────────────────────────────────────────────────────────────────────────────────

	private async record(
		context: EverWorksMappingContext,
		teamId: ID,
		team: EverWorksTeam,
		version: number | null,
		snapshot: TeamSnapshot,
		direction: 'inbound' | 'outbound'
	): Promise<void> {
		const ewOnly: TeamEverWorksOnly = {
			slug: team.slug,
			description: team.description ?? null,
			parentTeamId: team.parentTeamId ?? null,
			managerAgentId: team.managerAgentId ?? null,
			avatarIcon: team.avatarIcon ?? null,
			members: team.members ?? [],
			resources: team.resources ?? []
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

	private async upsertMembership(context: EverWorksMappingContext, teamId: ID, employeeId: ID, isManager: boolean): Promise<void> {
		const repository = this.dataSource.getRepository(OrganizationTeamEmployee);
		const existing = await repository.findOne({ where: { organizationTeamId: teamId, employeeId } as never });
		if (existing) {
			if (!!existing.isManager !== isManager) await repository.update({ id: existing.id } as never, { isManager } as never);
			return;
		}
		await repository.save(
			repository.create({ tenantId: context.tenantId, organizationId: context.organizationId, organizationTeamId: teamId, employeeId, isManager } as never)
		);
	}

	private async currentMembers(teamId: ID): Promise<Array<{ employeeId: ID; isManager: boolean }>> {
		const rows = await this.dataSource.getRepository(OrganizationTeamEmployee).find({ where: { organizationTeamId: teamId } as never });
		return rows
			.map((row) => ({ employeeId: row.employeeId as ID, isManager: !!row.isManager }))
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
		const suggested = new Set(rows.map((row) => row.suggestion?.teamId).filter(Boolean));
		return {
			teams: rows,
			unmatchedTeams: gauzy.filter((g) => !linked.has(g.id as ID) && !suggested.has(g.id as ID)).map((g) => ({ teamId: g.id as ID, name: g.name }))
		};
	}
}
