import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { createHash } from 'node:crypto';
import { DataSource, In } from 'typeorm';
import { ID, ProjectStatusEnum } from '@gauzy/contracts';
import { Employee, IntegrationTenant, OrganizationProject, OrganizationProjectCreateCommand, OrganizationProjectEmployee, RequestContext } from '@gauzy/core';
import { EverWorksApiError, EverWorksClient, EverWorksNetworkError } from '../client/ever-works-client';
import type { EverWorksEventEnvelope, EverWorksListPage } from '../client/ever-works-client.types';
import type { EverWorksConnection } from '../connection/ever-works-connection.entity';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import { EverWorksSettingName } from '../ever-works-setting.enum';
import { EverWorksMappingContext, EverWorksMappingContextService } from '../mapping/ever-works-mapping-context.service';
import { EverWorksEntityLink, EverWorksLinkState, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import type { EverWorksSyncSweeper } from '../sync/ever-works-sync.loop';
import type { EverWorksApplyContext, EverWorksApplyOutcome, EverWorksInboundHandler } from '../sync/inbound/ever-works-inbound.applier';
import { EverWorksLinkService } from '../sync/links/ever-works-link.service';
import { gauzyTeamsFor, isSyncedVisibility, teamScopeFor } from '../teams/ever-works-team-scope';
import { isProjectWorksDisabled, projectWorkCreateBody, projectWorkIdempotencyKey } from './ever-works-project-work.mapper';

/** A member of an Ever Works work (contract v1 `WorkMemberRef`). */
export interface EverWorksWorkMember {
	userId: string;
	role: 'owner' | 'manager' | 'editor' | 'viewer';
}

/** An Ever Works work (contract v1 work DTO; also the `data` of `work.*` events). */
export interface EverWorksWork {
	id: string;
	organizationId?: string;
	version?: number;
	updatedAt?: string;
	name: string;
	slug?: string;
	description?: string | null;
	kind?: string;
	status?: 'draft' | 'active' | 'registered' | 'archived';
	website?: string | null;
	repoUrls?: string[];
	members?: EverWorksWorkMember[];
	teamIds?: string[];
	visibility?: string;
	webUrl?: string | null;
	deleted?: boolean;
}

/** The Ever Works values of the shared fields at the last sync (what an EW change is diffed against). */
interface WorkSnapshot {
	name?: string;
	description?: string | null;
	website?: string | null;
	repoUrl?: string | null;
	status?: string | null;
	members?: EverWorksWorkMember[];
	teamIds?: string[];
}

/** What only Ever Works has, kept on the link (merged on every write: a partial event never nulls it). */
interface WorkEverWorksOnly {
	slug?: string | null;
	kind?: string | null;
	repoUrls?: string[];
	webUrl?: string | null;
	visibility?: string | null;
	/** Ever Works members (user ids) Gauzy could not map at the last sync; retried on the next change and by the sweep. */
	unmappedMembers?: string[];
	/** Ever Works teams Gauzy could not map at the last sync; retried on the next change and by the sweep. */
	unmappedTeams?: string[];
	/**
	 * The Gauzy project the work's Ever Works external link (`PUT /links/work/:id`) points to, once Gauzy set it.
	 * The sweep links back a pair where it is not the paired project (a work paired on the Projects tab, one a
	 * project was created from, a pair from before the link-back); a work Gauzy created has it from its `externalRef`.
	 */
	linkedBack?: string | null;
	/** When a link-back of this pair was last refused (ISO): later sweeps try the never-tried and the oldest first. */
	linkBackTriedAt?: string | null;
}

/** One Ever Works work as the Projects tab shows it. */
export interface EverWorksWorkRow {
	ewWorkId: string;
	name: string;
	kind: string | null;
	status: string | null;
	website: string | null;
	linkedProjectId: ID | null;
	/** A Gauzy project with the same name or URL the admin may confirm (never linked silently), or `null`. */
	suggestion: { projectId: ID; reason: 'same_name' | 'same_url' } | null;
}

export interface EverWorksProjectsView {
	works: EverWorksWorkRow[];
	/** Gauzy projects of the organization linked to no work. */
	unmatchedProjects: Array<{ projectId: ID; name: string }>;
	/** Projects Ever Works did not create a work for in this request (G-P2-5), with the reason; the others were created. */
	failures?: Array<{ projectId: ID; message: string }>;
}

/** The admin's decisions on the Projects tab. */
export interface EverWorksProjectsDecision {
	links?: Array<{ ewWorkId: string; projectId: ID }>;
	unlinks?: string[];
	acceptSuggestions?: boolean;
	/** Works to create a Gauzy project from. */
	createInGauzy?: string[];
	/**
	 * Gauzy projects to create in Ever Works (G-P2-5), each as a repo-less work of kind `project`
	 * (EW-P2-4). Opt-in per project: Gauzy never creates a work on its own (D3).
	 */
	createInEverWorks?: ID[];
}

/** Why an Ever Works call failed, for a log line: the status and code, the network reason, or the error's name. */
function describeError(error: unknown): string {
	if (error instanceof EverWorksApiError) return `${error.status} ${error.code}`;
	if (error instanceof EverWorksNetworkError) return `network: ${error.reason}`.slice(0, 200);
	return error instanceof Error ? error.name : 'error';
}

/** A URL compared loosely: case, a trailing slash and a `.git` suffix do not matter. */
export function sameUrl(a: string | null | undefined, b: string | null | undefined): boolean {
	const norm = (url: string | null | undefined) =>
		(url ?? '')
			.trim()
			.toLowerCase()
			.replace(/\/+$/, '')
			.replace(/\.git$/, '');
	return !!norm(a) && norm(a) === norm(b);
}

/** Ever Works work status → Gauzy project status (`archived` is the project's `isArchived`, not a status). */
export function projectStatusOf(status: string | null | undefined): ProjectStatusEnum | null {
	if (status === 'draft') return ProjectStatusEnum.OPEN;
	if (status === 'active' || status === 'registered') return ProjectStatusEnum.IN_PROGRESS;
	return null;
}

const managerRoles = new Set(['owner', 'manager']);
const sameSet = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) => {
	const left = new Set(a);
	return left.size === new Set(b).size && b.every((value) => left.has(value));
};

/** How often the project sweep (members and teams paired since the last sync, link-backs) runs per connection. */
export const PROJECT_SWEEP_MS = 10 * 60_000;
/** Link-backs one sweep sends at most per mapping (the rest go with the next sweep). */
export const PROJECT_LINK_BACKS_PER_SWEEP = 50;

/**
 * Projects ↔ Works (plan 01 §10, plan 06 G-P1-8): **link only** in P1, linked as `PROJECT_WORK`.
 *
 * - The Projects tab pairs them: same-name or same-URL suggestions the admin confirms, or "create the
 *   Gauzy project from the work" (through the platform's project command). Nothing is paired silently,
 *   and a new work is not created in Gauzy on its own.
 * - For a linked pair the shared fields follow Ever Works: name, description, `website` → `projectUrl`,
 *   the primary repository → `openSourceProjectUrl`, status (draft → open, active/registered →
 *   in progress; archived → `isArchived`), members (owner/manager → manager), and the work's teams →
 *   `project.teams` (its team scope, D11). Only what changed in Ever Works since the last sync is
 *   written, so a Gauzy edit is not overwritten by an unrelated change. Nothing is pushed to Ever Works.
 * - `kind`, the slug, all repository URLs and members or teams Gauzy cannot map stay on the link.
 * - **Create in Ever Works (G-P2-5).** Opt-in per project on the same tab: the project becomes a
 *   repo-less work of kind `project` (EW-P2-4, behind Ever Works' `EVER_WORKS_PROJECT_WORKS_ENABLED`),
 *   with the project's teams as its scope (D11; a team not paired yet refuses the create, so the
 *   work never goes out organization-wide by mistake), owned by the requesting admin's Ever Works
 *   user when they are paired. From then on the pair syncs like any other (link only).
 */
@Injectable()
export class EverWorksProjectsService implements EverWorksInboundHandler, EverWorksSyncSweeper {
	readonly aggregateTypes = ['work'] as const;
	readonly sweepIntervalMs = PROJECT_SWEEP_MS;
	private readonly logger = new Logger('EverWorksProjects');
	/** "Create from work" claims in this process, one at a time per work. */
	private readonly claims = new Map<string, Promise<unknown>>();

	constructor(
		private readonly dataSource: DataSource,
		private readonly contexts: EverWorksMappingContextService,
		private readonly connections: EverWorksConnectionService,
		private readonly links: EverWorksLinkService,
		private readonly commandBus: CommandBus
	) {}

	// ── Projects tab ───────────────────────────────────────────────────────────────────────────────

	/** `GET /mappings/:id/projects`. */
	async projects(integrationTenantId: ID, organizationId?: ID): Promise<EverWorksProjectsView> {
		const context = await this.contexts.forRequest(integrationTenantId, organizationId);
		return this.view(context, await this.works(context));
	}

	/** `PUT /mappings/:id/projects`: confirms or removes pairs, accepts suggestions, creates projects from works. */
	async decide(integrationTenantId: ID, decision: EverWorksProjectsDecision, organizationId?: ID): Promise<EverWorksProjectsView> {
		const context = await this.contexts.forRequest(integrationTenantId, organizationId);
		// Creating a project writes a record, so it follows the mapping switch and the works direction like
		// the sync does (pairing only writes links, and stays available while the mapping is being set up).
		if (decision.createInGauzy?.length) {
			if (!context.isEnabled) throw new BadRequestException('The mapping is disabled; enable it before creating projects from works.');
			if (context.directions.works !== 'link_only') throw new BadRequestException('Works are not synced for this mapping, so projects cannot be created from works.');
		}
		const createInEverWorks = [...new Set(decision.createInEverWorks ?? [])];
		if (createInEverWorks.length) {
			if (!context.isEnabled) throw new BadRequestException('The mapping is disabled; enable it before creating works from projects.');
			if (context.directions.works !== 'link_only') throw new BadRequestException('Works are not synced for this mapping, so works cannot be created from projects.');
		}
		const works = await this.works(context);
		const byEw = new Map(works.map((work) => [work.id, work]));
		const pairs = [...(decision.links ?? [])];
		if (decision.acceptSuggestions) {
			const suggested = (await this.view(context, works)).works.flatMap((row) =>
				row.suggestion && !row.linkedProjectId ? [{ ewWorkId: row.ewWorkId, projectId: row.suggestion.projectId }] : []
			);
			// A project suggested for several works (e.g. works sharing a repository) is ambiguous: it is left for
			// the admin to pair one by one instead of failing the whole request. An explicit link in the same
			// request wins over a suggestion for either record.
			const timesSuggested = new Map<ID, number>();
			for (const suggestion of suggested) timesSuggested.set(suggestion.projectId, (timesSuggested.get(suggestion.projectId) ?? 0) + 1);
			const claimedEw = new Set(pairs.map((pair) => pair.ewWorkId));
			const claimedGauzy = new Set(pairs.map((pair) => pair.projectId));
			for (const suggestion of suggested) {
				if (timesSuggested.get(suggestion.projectId) !== 1 || claimedEw.has(suggestion.ewWorkId) || claimedGauzy.has(suggestion.projectId)) continue;
				pairs.push(suggestion);
			}
		}
		const projects = new Map((await this.gauzyProjects(context, [...pairs.map((pair) => pair.projectId), ...createInEverWorks])).map((p) => [p.id as ID, p]));
		const seenEw = new Set<string>();
		const seenGauzy = new Set<string>();
		for (const pair of pairs) {
			if (!byEw.has(pair.ewWorkId)) throw new BadRequestException(`${pair.ewWorkId} is not a work of the mapped Ever Works organization.`);
			if (!isSyncedVisibility(byEw.get(pair.ewWorkId)?.visibility)) throw new BadRequestException(`${pair.ewWorkId} is private in Ever Works; private works never sync.`);
			if (!projects.has(pair.projectId)) throw new BadRequestException(`${pair.projectId} is not an active project of this organization.`);
			if (seenEw.has(pair.ewWorkId) || seenGauzy.has(pair.projectId)) throw new BadRequestException('Each project and each work can be paired once.');
			seenEw.add(pair.ewWorkId);
			seenGauzy.add(pair.projectId);
		}
		for (const ewWorkId of decision.createInGauzy ?? []) {
			if (!byEw.has(ewWorkId)) throw new BadRequestException(`${ewWorkId} is not a work of the mapped Ever Works organization.`);
			if (!isSyncedVisibility(byEw.get(ewWorkId)?.visibility)) throw new BadRequestException(`${ewWorkId} is private in Ever Works; private works never sync.`);
		}
		for (const projectId of createInEverWorks) {
			if (!projects.has(projectId)) throw new BadRequestException(`${projectId} is not an active project of this organization.`);
			if (seenGauzy.has(projectId)) throw new BadRequestException(`${projectId} is paired in this request; it cannot also be created in Ever Works.`);
			const paired = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK, projectId);
			if (paired && paired.state !== EverWorksLinkState.UNLINKED && !(decision.unlinks ?? []).includes(paired.ewId)) {
				throw new BadRequestException(`${projectId} is already paired with an Ever Works work.`);
			}
			// Teams first (D11 rule 4): a project on a team that is not paired yet would go out organization-wide.
			const scope = await this.teamScopeOfProject(context, projectId);
			if (scope.waitingFor) {
				throw new BadRequestException(`${projectId} is on the Gauzy team ${scope.waitingFor}, which is not paired with an Ever Works team yet; pair the team first.`);
			}
		}
		for (const ewWorkId of decision.unlinks ?? []) {
			const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK, ewWorkId);
			if (link) await this.links.remove(link);
		}
		for (const pair of pairs) {
			// Queued behind a "create in Ever Works" of the same project in this process (the later one replaces
			// the earlier, never half of it). Across processes the create checks the project's link again right
			// before it records, so it never replaces a pairing made meanwhile. Pairing holds no database lock:
			// it needs no connection beyond the ones its reads and writes borrow.
			await this.withWorkClaim(
				context,
				`gauzy-project:${pair.projectId}`,
				async () => {
					for (const stale of [
						await this.links.byEw(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK, pair.ewWorkId),
						await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK, pair.projectId)
					]) {
						if (stale) await this.links.remove(stale);
					}
					// Pairing changes neither record: from now on the work's changes apply to the project.
					await this.record(context, pair.projectId, byEw.get(pair.ewWorkId) as EverWorksWork, null);
				},
				{ database: false }
			);
		}
		await EverWorksSyncContext.run({ connectionId: context.connection.id as ID, eventId: `projects-tab:${context.integrationTenantId}` }, async () => {
			for (const ewWorkId of decision.createInGauzy ?? []) {
				// Claimed, then checked again: two overlapping requests never create two projects for one work.
				await this.withWorkClaim(context, ewWorkId, async () => {
					if (await this.links.byEw(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK, ewWorkId)) return;
					await this.createFromWork(context, byEw.get(ewWorkId) as EverWorksWork);
				});
			}
		});
		const failures: Array<{ projectId: ID; message: string }> = [];
		const created: EverWorksWork[] = [];
		if (createInEverWorks.length) {
			const client = this.connections.client(context.connection, context.everWorksOrganizationSlug);
			for (const projectId of createInEverWorks) {
				// Claimed, then checked again: two overlapping requests never create two works for one project.
				const result = await this.withWorkClaim(context, `gauzy-project:${projectId}`, async () => {
					const paired = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK, projectId);
					if (paired && paired.state !== EverWorksLinkState.UNLINKED) return null;
					return this.createInEverWorks(context, client, projects.get(projectId) as OrganizationProject);
				});
				if (typeof result === 'string') failures.push({ projectId, message: result });
				else if (result) created.push(result);
			}
		}
		let latest = works;
		try {
			latest = await this.works(context);
		} catch (error) {
			// Works were created (or refused) already: an Ever Works outage now must not hide those results.
			// The view is built from the list read at the start plus the works created here.
			if (!createInEverWorks.length) throw error;
			this.logger.warn(`Mapping ${context.integrationTenantId}: the works could not be listed again (${error instanceof Error ? error.name : 'error'}).`);
			latest = [...works, ...created.filter((work) => !works.some((known) => known.id === work.id))];
		}
		const view = await this.view(context, latest);
		return failures.length ? { ...view, failures } : view;
	}

	// ── EW → G ─────────────────────────────────────────────────────────────────────────────────────

	/** Inbound handler: `work.created/updated/archived/deleted` and `work.member.*`. */
	async apply(envelope: EverWorksEventEnvelope, applyContext: EverWorksApplyContext): Promise<EverWorksApplyOutcome> {
		const context = envelope.organizationId ? await this.contexts.forEverWorksOrganization(applyContext.connection, envelope.organizationId) : null;
		if (!context) return { status: 'skipped', message: 'no mapping for the Ever Works organization' };
		if (!context.isEnabled) return { status: 'skipped', message: 'the mapping is disabled' };
		if (context.directions.works !== 'link_only') return { status: 'skipped', message: 'works are not synced' };
		const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK, envelope.aggregate.id);
		if (!link) return { status: 'skipped', message: 'not linked: pair it on the Projects tab' };
		if (link.state === EverWorksLinkState.UNLINKED) return { status: 'skipped', message: 'the work is no longer synced' };
		const version = envelope.aggregate.version ?? null;
		if (link.ewVersion != null && version != null && version <= link.ewVersion) return { status: 'skipped', message: 'already applied (version)' };
		const data = (envelope.data ?? {}) as Record<string, unknown>;
		if (envelope.type !== 'work.deleted') {
			// Private works never sync (rule 5): a work that is (or became) private stops syncing; the project is kept.
			const visibility = data['visibility'] !== undefined ? (data['visibility'] as string | null) : this.ewOnlyOf(link).visibility;
			if (!isSyncedVisibility(visibility)) {
				await this.links.unlink(link, 'private in Ever Works; private works never sync');
				return { status: 'skipped', message: 'the work is private in Ever Works; it is no longer synced' };
			}
		}
		const projectId = link.gauzyId as ID;
		const exists = await this.dataSource.getRepository(OrganizationProject).findOne({ where: { id: projectId, tenantId: context.tenantId } as never, withDeleted: true });
		if (!exists) return { status: 'skipped', message: 'the Gauzy project is gone' };
		switch (envelope.type) {
			case 'work.created':
			case 'work.updated':
			case 'work.archived':
				await this.applyWork(context, link, { ...(data as unknown as EverWorksWork), id: envelope.aggregate.id, ...(envelope.type === 'work.archived' ? { status: 'archived' as const } : {}) }, version);
				return { status: 'applied' };
			case 'work.deleted':
				await this.dataSource.getRepository(OrganizationProject).update({ id: projectId } as never, { isArchived: true, archivedAt: new Date() } as never);
				await this.links.unlink(link, 'deleted in Ever Works; the Gauzy project is archived');
				return { status: 'applied' };
			case 'work.member.added':
			case 'work.member.updated':
			case 'work.member.removed': {
				const member = data as unknown as EverWorksWorkMember & { deleted?: boolean };
				const snapshot = this.links.snapshot<WorkSnapshot>(link);
				const members = (snapshot.members ?? []).filter((m) => m.userId !== member.userId);
				if (envelope.type !== 'work.member.removed' && !member.deleted) members.push({ userId: member.userId, role: member.role });
				await this.applyWork(context, link, { ...this.workFrom(link), members }, version);
				return { status: 'applied' };
			}
			default:
				return { status: 'skipped', message: `${envelope.type} is not synced` };
		}
	}

	/** Writes what changed in Ever Works since the last sync to the linked project, then records the link. */
	private async applyWork(context: EverWorksMappingContext, link: EverWorksEntityLink, work: EverWorksWork, version: number | null): Promise<void> {
		const projectId = link.gauzyId as ID;
		const before = this.links.snapshot<WorkSnapshot>(link);
		const next = this.snapshotOf(work, before);
		const changes: Record<string, unknown> = {};
		if (next.name && next.name !== before.name) changes['name'] = next.name;
		if (next.description !== before.description) changes['description'] = next.description;
		if (next.website !== before.website) changes['projectUrl'] = next.website;
		if (next.repoUrl !== before.repoUrl) changes['openSourceProjectUrl'] = next.repoUrl;
		if (next.status !== before.status) {
			if (next.status === 'archived') Object.assign(changes, { isArchived: true, archivedAt: new Date() });
			else {
				const status = projectStatusOf(next.status);
				if (status) changes['status'] = status;
				if (before.status === 'archived') Object.assign(changes, { isArchived: false, archivedAt: null });
			}
		}
		if (Object.keys(changes).length) await this.dataSource.getRepository(OrganizationProject).update({ id: projectId } as never, changes as never);
		// Members and teams Gauzy could not map last time are tried again (a person or team paired since joins).
		const ew = this.ewOnlyOf(link);
		const members = await this.applyMembers(context, projectId, before.members ?? [], next.members ?? [], ew.unmappedMembers ?? []);
		const teams = await this.applyTeams(context, projectId, before.teamIds ?? [], next.teamIds ?? [], ew.unmappedTeams ?? []);
		await this.record(context, projectId, work, version, next, link, { members, teams });
	}

	/**
	 * Ever Works' member set moved: the same adds, removes and manager changes on the project. Members in
	 * `retry` (unmapped at the last sync) are applied again even when unchanged. Returns the members of
	 * `next` Gauzy still cannot map, for the link to keep.
	 */
	private async applyMembers(
		context: EverWorksMappingContext,
		projectId: ID,
		previous: EverWorksWorkMember[],
		next: EverWorksWorkMember[],
		retry: ReadonlyArray<string> = []
	): Promise<string[]> {
		const repository = this.dataSource.getRepository(OrganizationProjectEmployee);
		const before = new Map(previous.map((m) => [m.userId, managerRoles.has(m.role)]));
		const after = new Map(next.map((m) => [m.userId, managerRoles.has(m.role)]));
		const again = new Set(retry);
		const unmapped: string[] = [];
		for (const [userId, isManager] of after) {
			if (before.has(userId) && before.get(userId) === isManager && !again.has(userId)) continue;
			const employeeId = await this.employeeFor(context, userId);
			if (!employeeId) {
				unmapped.push(userId);
				continue;
			}
			const existing = await repository.findOne({ where: { organizationProjectId: projectId, employeeId } as never });
			if (existing) {
				if (!!existing.isManager !== isManager) await repository.update({ id: existing.id } as never, { isManager } as never);
			} else {
				await repository.save(
					repository.create({ tenantId: context.tenantId, organizationId: context.organizationId, organizationProjectId: projectId, employeeId, isManager } as never)
				);
			}
		}
		for (const userId of before.keys()) {
			if (after.has(userId)) continue;
			const employeeId = await this.employeeFor(context, userId);
			if (employeeId) await repository.delete({ organizationProjectId: projectId, employeeId } as never);
		}
		return unmapped;
	}

	/**
	 * The work's teams moved: the same adds and removes on `project.teams`. Teams in `retry` (unmapped at
	 * the last sync) are added again even when unchanged. Returns the teams of `next` Gauzy still cannot
	 * map, for the link to keep.
	 */
	private async applyTeams(context: EverWorksMappingContext, projectId: ID, previous: string[], next: string[], retry: ReadonlyArray<string> = []): Promise<string[]> {
		const teamLinks = (await this.links.list(context.integrationTenantId, EverWorksLinkType.TEAM)).filter((link) => link.state !== EverWorksLinkState.UNLINKED);
		const gauzyTeamOf = new Map(teamLinks.map((link) => [link.ewId, link.gauzyId as ID]));
		const again = new Set(retry);
		const added = gauzyTeamsFor(
			next.filter((id) => !previous.includes(id) || again.has(id)),
			gauzyTeamOf
		);
		const removed = gauzyTeamsFor(previous.filter((id) => !next.includes(id)), gauzyTeamOf).teamIds;
		if (!added.teamIds.length && !removed.length) return added.unmapped;
		const relation = this.dataSource.createQueryBuilder().relation(OrganizationProject, 'teams').of(projectId);
		const current = new Set(((await relation.loadMany()) as Array<{ id: ID }>).map((team) => team.id));
		const toAdd = added.teamIds.filter((id) => !current.has(id));
		const toRemove = removed.filter((id) => current.has(id));
		if (toAdd.length || toRemove.length) await relation.addAndRemove(toAdd, toRemove);
		return added.unmapped;
	}

	/** Creates the Gauzy project of a work (the platform's project command), applies its fields and links it. */
	private async createFromWork(context: EverWorksMappingContext, work: EverWorksWork): Promise<ID> {
		const project = (await this.commandBus.execute(
			new OrganizationProjectCreateCommand({
				name: work.name,
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				description: work.description ?? undefined,
				projectUrl: work.website ?? undefined,
				openSourceProjectUrl: work.repoUrls?.[0] ?? undefined,
				status: projectStatusOf(work.status) ?? undefined
			} as never)
		)) as OrganizationProject;
		const projectId = project.id as ID;
		if (work.status === 'archived') {
			// An archived work makes an archived project (the create command makes an active one).
			await this.dataSource
				.getRepository(OrganizationProject)
				.update({ id: projectId, tenantId: context.tenantId } as never, { isArchived: true, archivedAt: new Date() } as never);
		}
		// Members and teams follow the work; the fields above were written at creation.
		const created = this.snapshotOf(work, {});
		const members = await this.applyMembers(context, projectId, [], created.members ?? []);
		const teams = await this.applyTeams(context, projectId, [], created.teamIds ?? []);
		await this.record(context, projectId, work, work.version ?? null, created, null, { members, teams });
		this.logger.log(`Ever Works work ${work.id} created as Gauzy project ${projectId} (organization ${context.organizationId}).`);
		return projectId;
	}

	// ── G → EW: create in Ever Works (G-P2-5) ─────────────────────────────────────────────────────────

	/**
	 * Creates the Ever Works work of a Gauzy project (a repo-less `project` work, EW-P2-4) and links the
	 * pair. Returns the work when it is linked, or why it was not. Nothing in Gauzy
	 * changes: the work starts from the project's fields, and from now on Ever Works' changes apply to the
	 * project like for any pair. The deterministic `Idempotency-Key` plus `externalRef` make a retry
	 * (or a lost answer) return the same work instead of a second one.
	 */
	private async createInEverWorks(context: EverWorksMappingContext, client: EverWorksClient, project: OrganizationProject): Promise<string | EverWorksWork> {
		const projectId = project.id as ID;
		const connectionId = context.connection.id as ID;
		const team = await this.teamScopeOfProject(context, projectId);
		if (!team.scope) return `the Gauzy team ${team.waitingFor} is not paired with an Ever Works team yet; pair the team first`;
		const body = projectWorkCreateBody({ id: projectId, name: project.name, description: project.description, projectUrl: project.projectUrl }, team.scope, connectionId);
		if (!body['name']) return 'the project has no name';
		const actAsUserId = await this.actAsUserOf(context);
		let work: EverWorksWork | null = null;
		try {
			work = await this.postWork(client, body, connectionId, projectId, actAsUserId);
		} catch (error) {
			if (error instanceof EverWorksApiError && !error.retryable) {
				if (isProjectWorksDisabled(error)) return 'Project works are switched off in Ever Works (EVER_WORKS_PROJECT_WORKS_ENABLED); ask the Ever Works operator to enable them';
				return `Ever Works refused the work (${error.status} ${error.code}: ${error.message})`;
			}
			if (error instanceof EverWorksApiError || error instanceof EverWorksNetworkError) {
				this.logger.warn(`Project ${projectId}: the Ever Works work could not be created (${error.message.slice(0, 200)}).`);
				return 'Ever Works could not be reached; try again (the retry returns the same work)';
			}
			throw error;
		}
		if (!work?.id) return 'Ever Works answered without a work';
		// A repeat of the same externalRef answers the existing work: never re-pair one another project holds.
		const holder = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK, work.id);
		if (holder && holder.state !== EverWorksLinkState.UNLINKED && holder.gauzyId !== projectId) {
			return `Ever Works already has a work for this project (${work.id}), paired with another Gauzy project`;
		}
		// Nor replace a pairing of this project made meanwhile (outside this process's claim) with another work.
		const pairedNow = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK, projectId);
		if (pairedNow && pairedNow.state !== EverWorksLinkState.UNLINKED && pairedNow.ewId !== work.id) {
			return `the project was paired with the Ever Works work ${pairedNow.ewId} meanwhile; the created work ${work.id} is not linked`;
		}
		// Recorded as Ever Works answered it, so the next Ever Works change is diffed against what it holds.
		// Its `externalRef` is the link back to the project already.
		await this.record(context, projectId, work, work.version ?? null, this.snapshotOf(work, {}), null, { members: [], teams: [] }, 'outbound', { linkedBack: projectId });
		this.logger.log(`Gauzy project ${projectId} created in Ever Works as work ${work.id} (organization ${context.organizationId}).`);
		return work;
	}

	/** `POST /works`, as the admin's Ever Works user when they may act here, else as the integration (plan 03 §C.3). */
	private async postWork(client: EverWorksClient, body: Record<string, unknown>, connectionId: ID, projectId: ID, actAsUserId: string | null): Promise<EverWorksWork> {
		try {
			return await client.request<EverWorksWork>('POST', '/works', { body, idempotencyKey: projectWorkIdempotencyKey(connectionId, projectId, body), actAsUserId });
		} catch (error) {
			if (!(actAsUserId && error instanceof EverWorksApiError && error.status === 403 && error.code === 'act_as_forbidden')) throw error;
			return client.request<EverWorksWork>('POST', '/works', { body, idempotencyKey: projectWorkIdempotencyKey(connectionId, projectId, body, 'integration') });
		}
	}

	/** The scope a project goes out with (D11): its mapped teams, or `waitingFor` the first team not paired yet. */
	private async teamScopeOfProject(context: EverWorksMappingContext, projectId: ID): Promise<ReturnType<typeof teamScopeFor>> {
		const teams = (await this.dataSource.createQueryBuilder().relation(OrganizationProject, 'teams').of(projectId).loadMany()) as Array<{ id: ID }>;
		const teamLinks = (await this.links.list(context.integrationTenantId, EverWorksLinkType.TEAM)).filter((link) => link.state !== EverWorksLinkState.UNLINKED);
		return teamScopeFor(
			teams.map((team) => team.id),
			new Map(teamLinks.map((link) => [link.gauzyId as ID, link.ewId]))
		);
	}

	/** The Ever Works user the signed-in admin is paired with in this organization (`X-Act-As-User`), or `null`. */
	private async actAsUserOf(context: EverWorksMappingContext): Promise<string | null> {
		let userId: ID | null = null;
		try {
			userId = (RequestContext.currentUserId() as ID) ?? null;
		} catch {
			userId = null;
		}
		if (!userId) return null;
		const employee = await this.dataSource
			.getRepository(Employee)
			.findOne({ where: { userId, tenantId: context.tenantId, organizationId: context.organizationId } as never });
		if (!employee?.id) return null;
		const person = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.MEMBER, employee.id as ID);
		return person && person.state !== EverWorksLinkState.UNLINKED ? person.ewId : null;
	}

	/**
	 * Runs `fn` with the work claimed, so two overlapping "create from work" requests cannot both create a
	 * project: one at a time per work in this process, and across processes a session lock on Postgres
	 * (advisory lock) or MySQL (`GET_LOCK`). SQLite runs in one process. `fn` checks the link again inside.
	 */
	private async withWorkClaim<T>(context: EverWorksMappingContext, ewWorkId: string, fn: () => Promise<T>, options: { database?: boolean } = {}): Promise<T> {
		const key = `${context.integrationTenantId}:${ewWorkId}`;
		const previous = this.claims.get(key) ?? Promise.resolve();
		// `database: false`: this process only — no session lock, so no second pooled connection is held
		// while `fn` reads and writes through the pool.
		const run = () => (options.database === false ? fn() : this.withDatabaseLock(`ever-works:project-create:${key}`, fn));
		const current = previous.catch(() => undefined).then(run);
		this.claims.set(key, current);
		try {
			return await current;
		} finally {
			if (this.claims.get(key) === current) this.claims.delete(key);
		}
	}

	private async withDatabaseLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
		const type = this.dataSource.options?.type;
		if (type !== 'postgres' && type !== 'mysql' && type !== 'mariadb') return fn();
		// MySQL lock names are at most 64 characters: a digest of the name.
		const lockName = type === 'postgres' ? name : `ew:${createHash('sha256').update(name).digest('hex').slice(0, 48)}`;
		const runner = this.dataSource.createQueryRunner();
		await runner.connect();
		try {
			if (type === 'postgres') {
				await runner.query('SELECT pg_advisory_lock(hashtext($1))', [lockName]);
			} else {
				const rows = (await runner.query('SELECT GET_LOCK(?, 30) AS locked', [lockName])) as Array<{ locked: number | string | null }>;
				if (Number(rows?.[0]?.locked) !== 1) throw new ConflictException('Another request is creating this project; try again.');
			}
			try {
				return await fn();
			} finally {
				if (type === 'postgres') await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [lockName]);
				else await runner.query('SELECT RELEASE_LOCK(?)', [lockName]);
			}
		} finally {
			await runner.release();
		}
	}

	// ── Sweep ──────────────────────────────────────────────────────────────────────────────────────

	/**
	 * The project sweep, run by the sync loop for a connection it holds: Ever Works members and teams of a
	 * linked work that Gauzy could not map join the project once their person or team is paired, without
	 * waiting for the work to change again.
	 */
	async sweep(connection: EverWorksConnection): Promise<void> {
		for (const context of await this.contextsOf(connection)) {
			if (!context.isEnabled || context.directions.works !== 'link_only') continue;
			const links = (await this.links.list(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK)).filter((link) => link.state === EverWorksLinkState.OK);
			for (const link of links) {
				const ew = this.ewOnlyOf(link);
				if (!ew.unmappedMembers?.length && !ew.unmappedTeams?.length) continue;
				await EverWorksSyncContext.run({ connectionId: connection.id as ID, eventId: `project-sweep:${link.ewId}` }, async () => {
					const snapshot = this.links.snapshot<WorkSnapshot>(link);
					const projectId = link.gauzyId as ID;
					const members = await this.applyMembers(context, projectId, snapshot.members ?? [], snapshot.members ?? [], ew.unmappedMembers ?? []);
					const teams = await this.applyTeams(context, projectId, snapshot.teamIds ?? [], snapshot.teamIds ?? [], ew.unmappedTeams ?? []);
					if (sameSet(members, ew.unmappedMembers ?? []) && sameSet(teams, ew.unmappedTeams ?? [])) return;
					// Only the unmapped lists move: the snapshot and the version stay as they were.
					await this.record(context, projectId, this.workFrom(link), link.ewVersion ?? null, snapshot, link, { members, teams });
				});
			}
			// After the member and team saves above (they rewrite the whole row from this sweep's read).
			await this.linkBack(context, links);
		}
	}

	/**
	 * Shows the Gauzy project on each paired work that does not show it yet (`PUT /links/work/:id`, as for a task
	 * created from Ever Works): a work paired on the Projects tab, one a project was created from, or a pair made
	 * before the link-back. In the sweep, off the Projects tab's response, at most
	 * {@link PROJECT_LINK_BACKS_PER_SWEEP} per run, in order: each pair is read again right before its link is sent
	 * and before it is recorded, so a work paired again meanwhile never gets the older project. Best effort: a
	 * refusal is logged and tried again by a later sweep; an outage ends this run's link-backs.
	 */
	private async linkBack(context: EverWorksMappingContext, links: EverWorksEntityLink[]): Promise<void> {
		// Never tried first, then the longest ago: a pair Ever Works keeps refusing never holds up the others.
		const triedAt = (link: EverWorksEntityLink) => this.ewOnlyOf(link).linkBackTriedAt ?? '';
		const due = links
			.filter((link) => this.ewOnlyOf(link).linkedBack !== link.gauzyId)
			.sort((a, b) => triedAt(a).localeCompare(triedAt(b)))
			.slice(0, PROJECT_LINK_BACKS_PER_SWEEP);
		if (!due.length) return;
		const client = this.connections.client(context.connection, context.everWorksOrganizationSlug);
		const stillPaired = async (link: EverWorksEntityLink) => {
			const now = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK, link.ewId);
			return now && now.id === link.id && now.gauzyId === link.gauzyId && now.state === EverWorksLinkState.OK ? now : null;
		};
		// Only the link-back fields move, and only on the row as just read (see `patchEverWorksOnly`).
		const mark = async (link: EverWorksEntityLink, fields: Pick<WorkEverWorksOnly, 'linkedBack' | 'linkBackTriedAt'>) => {
			const current = await stillPaired(link);
			if (current) await this.links.patchEverWorksOnly(current, { ...this.ewOnlyOf(current), ...fields });
		};
		for (const link of due) {
			if (!(await stillPaired(link))) continue;
			try {
				await client.request('PUT', `/links/work/${encodeURIComponent(link.ewId)}`, { body: { externalId: link.gauzyId, installationId: context.connection.id } });
			} catch (error) {
				this.logger.warn(`The Ever Works work ${link.ewId} was not linked back to Gauzy project ${link.gauzyId} (${describeError(error)}).`);
				if (error instanceof EverWorksNetworkError || (error instanceof EverWorksApiError && error.retryable)) return;
				await mark(link, { linkBackTriedAt: new Date().toISOString() });
				continue;
			}
			await mark(link, { linkedBack: link.gauzyId as string, linkBackTriedAt: null });
		}
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

	// ── Shared ─────────────────────────────────────────────────────────────────────────────────────

	private snapshotOf(work: EverWorksWork, before: WorkSnapshot): WorkSnapshot {
		return {
			name: work.name ?? before.name,
			description: work.description !== undefined ? work.description : (before.description ?? null),
			website: work.website !== undefined ? work.website : (before.website ?? null),
			repoUrl: work.repoUrls !== undefined ? (work.repoUrls[0] ?? null) : (before.repoUrl ?? null),
			status: work.status ?? before.status ?? null,
			members: work.members ?? before.members ?? [],
			teamIds: work.teamIds ?? before.teamIds ?? []
		};
	}

	/**
	 * Records the link. The Ever Works-only fields are merged with what the link holds (a member event or a
	 * partial update never nulls the kind, the slug or the repository URLs).
	 */
	private async record(
		context: EverWorksMappingContext,
		projectId: ID,
		work: EverWorksWork,
		version: number | null,
		snapshot?: WorkSnapshot,
		link?: EverWorksEntityLink | null,
		unmapped?: { members: string[]; teams: string[] },
		direction: 'inbound' | 'outbound' = 'inbound',
		extra: Pick<WorkEverWorksOnly, 'linkedBack'> = {}
	): Promise<void> {
		const previous = this.ewOnlyOf(link);
		const ewOnly: WorkEverWorksOnly = {
			slug: work.slug ?? previous.slug ?? null,
			kind: work.kind ?? previous.kind ?? null,
			repoUrls: work.repoUrls ?? previous.repoUrls ?? [],
			webUrl: work.webUrl !== undefined ? work.webUrl : (previous.webUrl ?? null),
			visibility: work.visibility ?? previous.visibility ?? null,
			unmappedMembers: unmapped?.members ?? previous.unmappedMembers ?? [],
			unmappedTeams: unmapped?.teams ?? previous.unmappedTeams ?? [],
			// Kept only for the project it was set for (a link recorded for another project is linked back again).
			linkedBack: extra.linkedBack ?? (previous.linkedBack && previous.linkedBack === projectId ? previous.linkedBack : null),
			linkBackTriedAt: previous.linkBackTriedAt ?? null
		};
		await this.links.record({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			entityType: EverWorksLinkType.PROJECT_WORK,
			gauzyId: projectId,
			ewId: work.id,
			ewVersion: version ?? work.version ?? null,
			// Kept as stored when the event does not carry it.
			ewUpdatedAt: work.updatedAt,
			snapshot: (snapshot ?? this.snapshotOf(work, {})) as unknown as Record<string, unknown>,
			ewOnly: ewOnly as unknown as Record<string, unknown>,
			direction
		});
	}

	private ewOnlyOf(link: EverWorksEntityLink | null | undefined): WorkEverWorksOnly {
		if (!link?.ewOnly) return {};
		try {
			return JSON.parse(link.ewOnly) as WorkEverWorksOnly;
		} catch {
			return {};
		}
	}

	/**
	 * The Ever Works side of a linked work, as last synced: only the name is set, because `snapshotOf()`
	 * falls back to the snapshot for every shared field an event leaves out and `record()` to the link for
	 * the Ever Works-only ones (all repository URLs included).
	 */
	private workFrom(link: EverWorksEntityLink): EverWorksWork {
		return { id: link.ewId, name: this.links.snapshot<WorkSnapshot>(link).name ?? '' };
	}

	private async employeeFor(context: EverWorksMappingContext, ewUserId: string): Promise<ID | null> {
		const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.MEMBER, ewUserId);
		return link && link.state !== EverWorksLinkState.UNLINKED ? (link.gauzyId as ID) : null;
	}

	private async works(context: EverWorksMappingContext): Promise<EverWorksWork[]> {
		const client = this.connections.client(context.connection, context.everWorksOrganizationSlug);
		const works: EverWorksWork[] = [];
		let cursor: string | null = null;
		for (let page = 0; page < 100; page++) {
			const result: EverWorksListPage<EverWorksWork> = await client.request('GET', '/works', { query: { limit: 500, cursor } });
			works.push(...(result.data ?? []));
			if (!result.hasMore || !result.nextCursor) break;
			cursor = result.nextCursor;
		}
		return works.filter((work) => !work.deleted);
	}

	private async gauzyProjects(context: EverWorksMappingContext, only?: ID[]): Promise<OrganizationProject[]> {
		if (only && !only.length) return [];
		return this.dataSource.getRepository(OrganizationProject).find({
			where: { tenantId: context.tenantId, organizationId: context.organizationId, isArchived: false, ...(only ? { id: In(only) } : {}) } as never
		});
	}

	private async view(context: EverWorksMappingContext, works: EverWorksWork[]): Promise<EverWorksProjectsView> {
		const links = (await this.links.list(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK)).filter((link) => link.state !== EverWorksLinkState.UNLINKED);
		const linkByEw = new Map(links.map((link) => [link.ewId, link.gauzyId as ID]));
		const linked = new Set(links.map((link) => link.gauzyId as ID));
		const projects = await this.gauzyProjects(context);
		// Private works never sync (rule 5): they are neither listed nor suggested.
		const rows: EverWorksWorkRow[] = works.filter((work) => isSyncedVisibility(work.visibility)).map((work) => {
			const linkedProjectId = linkByEw.get(work.id) ?? null;
			const free = projects.filter((p) => !linked.has(p.id as ID));
			const byUrl = linkedProjectId
				? undefined
				: free.find(
						(p) =>
							sameUrl(p.projectUrl, work.website) ||
							(work.repoUrls ?? []).some((url) => sameUrl(p.openSourceProjectUrl, url))
					);
			const byName = linkedProjectId || byUrl ? undefined : free.find((p) => !!p.name && p.name.trim().toLowerCase() === (work.name ?? '').trim().toLowerCase());
			return {
				ewWorkId: work.id,
				name: work.name,
				kind: work.kind ?? null,
				status: work.status ?? null,
				website: work.website ?? null,
				linkedProjectId,
				suggestion: byUrl ? { projectId: byUrl.id as ID, reason: 'same_url' } : byName ? { projectId: byName.id as ID, reason: 'same_name' } : null
			};
		});
		return {
			works: rows,
			// A suggestion is not a pairing: a suggested project stays unmatched until the admin confirms it.
			unmatchedProjects: projects.filter((p) => !linked.has(p.id as ID)).map((p) => ({ projectId: p.id as ID, name: p.name as string }))
		};
	}
}
