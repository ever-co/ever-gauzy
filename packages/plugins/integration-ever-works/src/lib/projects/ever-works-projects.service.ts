import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource, In } from 'typeorm';
import { ID, ProjectStatusEnum } from '@gauzy/contracts';
import { OrganizationProject, OrganizationProjectCreateCommand, OrganizationProjectEmployee } from '@gauzy/core';
import type { EverWorksEventEnvelope, EverWorksListPage } from '../client/ever-works-client.types';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import { EverWorksMappingContext, EverWorksMappingContextService } from '../mapping/ever-works-mapping-context.service';
import { EverWorksEntityLink, EverWorksLinkState, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import type { EverWorksApplyContext, EverWorksApplyOutcome, EverWorksInboundHandler } from '../sync/inbound/ever-works-inbound.applier';
import { EverWorksLinkService } from '../sync/links/ever-works-link.service';
import { gauzyTeamsFor } from '../teams/ever-works-team-scope';

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
}

/** The admin's decisions on the Projects tab. */
export interface EverWorksProjectsDecision {
	links?: Array<{ ewWorkId: string; projectId: ID }>;
	unlinks?: string[];
	acceptSuggestions?: boolean;
	/** Works to create a Gauzy project from. */
	createInGauzy?: string[];
}

/** A URL compared loosely: case, a trailing slash and a `.git` suffix do not matter. */
export function sameUrl(a: string | null | undefined, b: string | null | undefined): boolean {
	const norm = (url: string | null | undefined) =>
		(url ?? '')
			.trim()
			.toLowerCase()
			.replace(/\.git$/, '')
			.replace(/\/+$/, '');
	return !!norm(a) && norm(a) === norm(b);
}

/** Ever Works work status → Gauzy project status (`archived` is the project's `isArchived`, not a status). */
export function projectStatusOf(status: string | null | undefined): ProjectStatusEnum | null {
	if (status === 'draft') return ProjectStatusEnum.OPEN;
	if (status === 'active' || status === 'registered') return ProjectStatusEnum.IN_PROGRESS;
	return null;
}

const managerRoles = new Set(['owner', 'manager']);

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
 */
@Injectable()
export class EverWorksProjectsService implements EverWorksInboundHandler {
	readonly aggregateTypes = ['work'] as const;
	private readonly logger = new Logger('EverWorksProjects');

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
		const works = await this.works(context);
		const byEw = new Map(works.map((work) => [work.id, work]));
		const pairs = [...(decision.links ?? [])];
		if (decision.acceptSuggestions) {
			for (const row of (await this.view(context, works)).works) {
				if (row.suggestion && !row.linkedProjectId) pairs.push({ ewWorkId: row.ewWorkId, projectId: row.suggestion.projectId });
			}
		}
		const projects = new Map((await this.gauzyProjects(context, pairs.map((pair) => pair.projectId))).map((p) => [p.id as ID, p]));
		const seenEw = new Set<string>();
		const seenGauzy = new Set<string>();
		for (const pair of pairs) {
			if (!byEw.has(pair.ewWorkId)) throw new BadRequestException(`${pair.ewWorkId} is not a work of the mapped Ever Works organization.`);
			if (!projects.has(pair.projectId)) throw new BadRequestException(`${pair.projectId} is not an active project of this organization.`);
			if (seenEw.has(pair.ewWorkId) || seenGauzy.has(pair.projectId)) throw new BadRequestException('Each project and each work can be paired once.');
			seenEw.add(pair.ewWorkId);
			seenGauzy.add(pair.projectId);
		}
		for (const ewWorkId of decision.createInGauzy ?? []) {
			if (!byEw.has(ewWorkId)) throw new BadRequestException(`${ewWorkId} is not a work of the mapped Ever Works organization.`);
		}
		for (const ewWorkId of decision.unlinks ?? []) {
			const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK, ewWorkId);
			if (link) await this.links.remove(link);
		}
		for (const pair of pairs) {
			for (const stale of [
				await this.links.byEw(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK, pair.ewWorkId),
				await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK, pair.projectId)
			]) {
				if (stale) await this.links.remove(stale);
			}
			// Pairing changes neither record: from now on the work's changes apply to the project.
			await this.record(context, pair.projectId, byEw.get(pair.ewWorkId) as EverWorksWork, null);
		}
		await EverWorksSyncContext.run({ connectionId: context.connection.id as ID, eventId: `projects-tab:${context.integrationTenantId}` }, async () => {
			for (const ewWorkId of decision.createInGauzy ?? []) {
				if (await this.links.byEw(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK, ewWorkId)) continue;
				await this.createFromWork(context, byEw.get(ewWorkId) as EverWorksWork);
			}
		});
		return this.view(context, await this.works(context));
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
		await this.applyMembers(context, projectId, before.members ?? [], next.members ?? []);
		await this.applyTeams(context, projectId, before.teamIds ?? [], next.teamIds ?? []);
		await this.record(context, projectId, work, version, next);
	}

	/** Ever Works' member set moved: the same adds, removes and manager changes on the project. */
	private async applyMembers(context: EverWorksMappingContext, projectId: ID, previous: EverWorksWorkMember[], next: EverWorksWorkMember[]): Promise<void> {
		const repository = this.dataSource.getRepository(OrganizationProjectEmployee);
		const before = new Map(previous.map((m) => [m.userId, managerRoles.has(m.role)]));
		const after = new Map(next.map((m) => [m.userId, managerRoles.has(m.role)]));
		for (const [userId, isManager] of after) {
			if (before.has(userId) && before.get(userId) === isManager) continue;
			const employeeId = await this.employeeFor(context, userId);
			if (!employeeId) continue;
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
	}

	/** The work's teams moved: the same adds and removes on `project.teams` (teams Gauzy cannot map are kept on the link). */
	private async applyTeams(context: EverWorksMappingContext, projectId: ID, previous: string[], next: string[]): Promise<void> {
		const teamLinks = (await this.links.list(context.integrationTenantId, EverWorksLinkType.TEAM)).filter((link) => link.state !== EverWorksLinkState.UNLINKED);
		const gauzyTeamOf = new Map(teamLinks.map((link) => [link.ewId, link.gauzyId as ID]));
		const added = gauzyTeamsFor(next.filter((id) => !previous.includes(id)), gauzyTeamOf).teamIds;
		const removed = gauzyTeamsFor(previous.filter((id) => !next.includes(id)), gauzyTeamOf).teamIds;
		if (!added.length && !removed.length) return;
		const relation = this.dataSource.createQueryBuilder().relation(OrganizationProject, 'teams').of(projectId);
		const current = new Set(((await relation.loadMany()) as Array<{ id: ID }>).map((team) => team.id));
		const toAdd = added.filter((id) => !current.has(id));
		const toRemove = removed.filter((id) => current.has(id));
		if (toAdd.length || toRemove.length) await relation.addAndRemove(toAdd, toRemove);
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
		// Members and teams follow the work; the fields above were written at creation.
		const created = this.snapshotOf(work, {});
		await this.applyMembers(context, projectId, [], created.members ?? []);
		await this.applyTeams(context, projectId, [], created.teamIds ?? []);
		await this.record(context, projectId, work, work.version ?? null, created);
		this.logger.log(`Ever Works work ${work.id} created as Gauzy project ${projectId} (organization ${context.organizationId}).`);
		return projectId;
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

	private async record(context: EverWorksMappingContext, projectId: ID, work: EverWorksWork, version: number | null, snapshot?: WorkSnapshot): Promise<void> {
		await this.links.record({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			entityType: EverWorksLinkType.PROJECT_WORK,
			gauzyId: projectId,
			ewId: work.id,
			ewVersion: version ?? work.version ?? null,
			ewUpdatedAt: work.updatedAt ?? null,
			snapshot: (snapshot ?? this.snapshotOf(work, {})) as unknown as Record<string, unknown>,
			ewOnly: { slug: work.slug ?? null, kind: work.kind ?? null, repoUrls: work.repoUrls ?? [], webUrl: work.webUrl ?? null, visibility: work.visibility ?? null },
			direction: 'inbound'
		});
	}

	/** The Ever Works side of a linked work, as last synced. */
	private workFrom(link: EverWorksEntityLink): EverWorksWork {
		const snapshot = this.links.snapshot<WorkSnapshot>(link);
		return {
			id: link.ewId,
			name: snapshot.name ?? '',
			description: snapshot.description ?? null,
			website: snapshot.website ?? null,
			...(snapshot.repoUrl ? { repoUrls: [snapshot.repoUrl] } : {}),
			status: (snapshot.status ?? undefined) as EverWorksWork['status'],
			teamIds: snapshot.teamIds ?? []
		};
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
		const rows: EverWorksWorkRow[] = works.map((work) => {
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
