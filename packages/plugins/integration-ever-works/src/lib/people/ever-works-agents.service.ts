import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { EmployeeAgentSourceEnum, ID, IAgentEmployeeCreateInput, IEmployeeAgentProfileInput } from '@gauzy/contracts';
import { Employee, EmployeeAgentProfileService, EmployeeService, User } from '@gauzy/core';
import { EverWorksApiError } from '../client/ever-works-client';
import type { EverWorksEventEnvelope, EverWorksListPage } from '../client/ever-works-client.types';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import { EverWorksMappingContext, EverWorksMappingContextService } from '../mapping/ever-works-mapping-context.service';
import { EverWorksLinkState, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import type { EverWorksApplyContext, EverWorksApplyOutcome, EverWorksInboundHandler } from '../sync/inbound/ever-works-inbound.applier';
import { EverWorksInboundStore } from '../sync/inbound/ever-works-inbound.store';
import { EverWorksLinkService } from '../sync/links/ever-works-link.service';
import { isSyncedVisibility } from '../teams/ever-works-team-scope';

const NO_LONGER_SHARED = 'no longer shared from Ever Works (private)';

/** An Ever Works agent (contract v1 agent DTO). */
export interface EverWorksAgent {
	id: string;
	organizationId: string;
	version?: number;
	updatedAt?: string;
	visibility?: string;
	teamIds?: string[];
	name: string;
	slug: string;
	title?: string | null;
	capabilities?: string | null;
	status: string;
	scope: string;
	scopeTargetId: string;
	reportsToAgentId?: string | null;
	avatar?: { mode?: string; url?: string | null } | null;
	modelId?: string | null;
	lastRunAt?: string | null;
	webUrl?: string | null;
	deleted?: boolean;
}

/** The outcome of provisioning one agent. */
export interface EverWorksAgentResult {
	ewAgentId: string;
	employeeId: ID;
	created: boolean;
	archived: boolean;
}

/** The address domain of agent employees; `.invalid` (RFC 2606) so nothing can ever be delivered. */
export function agentEmailDomain(env: Record<string, string | undefined> = process.env): string {
	const configured = (env['EVER_WORKS_AGENT_EMAIL_DOMAIN'] || '').trim().toLowerCase();
	return /^([a-z0-9-]+\.)+invalid$/.test(configured) ? configured : 'agents.invalid';
}

/**
 * Agents (plan 01 §4, G-P1-6): each Ever Works agent of a mapped organization becomes a Gauzy employee of
 * kind `agent` with an `employee_agent_profile` (`source='ever_works'`, `managedExternally=true`),
 * created through the platform's agent-provisioning path (no password, no welcome email, no invite) and
 * linked as `AGENT`. One way, Ever Works → Gauzy: Ever Works owns its agents; their profile is rewritten
 * from Ever Works on every change, so an edit made in Gauzy does not survive and is never pushed. An
 * archived or deleted agent is archived (`isActive=false`, `isArchived=true`), never deleted.
 */
@Injectable()
export class EverWorksAgentsService implements EverWorksInboundHandler {
	readonly aggregateTypes = ['agent'] as const;
	private readonly logger = new Logger('EverWorksAgents');

	constructor(
		private readonly dataSource: DataSource,
		private readonly contexts: EverWorksMappingContextService,
		private readonly connections: EverWorksConnectionService,
		private readonly links: EverWorksLinkService,
		private readonly moduleRef: ModuleRef,
		private readonly inbound: EverWorksInboundStore
	) {}

	/**
	 * `POST /mappings/:id/agents/import`: queues every agent of the mapped Ever Works organization as an
	 * initial event. The sync loop applies them like any other event — one writer per connection, under
	 * its lease, with the version check — so an import never overwrites a newer change that arrived
	 * meanwhile. Managers come first (by depth of the reporting chain), so `reportsTo` resolves.
	 */
	async importAll(integrationTenantId: ID, organizationId?: ID): Promise<{ queued: number; duplicates: number }> {
		const context = await this.contexts.forRequest(integrationTenantId, organizationId);
		if (!context.isEnabled) throw new BadRequestException('The mapping is disabled; enable it before importing agents.');
		if (context.directions.agents === 'off') throw new BadRequestException('Agents are not synced for this mapping.');
		const client = this.connections.client(context.connection, context.everWorksOrganizationSlug);
		const agents: EverWorksAgent[] = [];
		let cursor: string | null = null;
		for (let page = 0; page < 100; page++) {
			const result: EverWorksListPage<EverWorksAgent> = await client.request('GET', '/agents', { query: { limit: 500, cursor } });
			agents.push(...(result.data ?? []));
			if (!result.hasMore || !result.nextCursor) break;
			cursor = result.nextCursor;
		}
		const depth = reportingDepths(agents);
		const totals = { queued: 0, duplicates: 0 };
		for (const agent of agents) {
			const version = agent.version ?? 0;
			const envelope = {
				id: `initial:agent:${agent.id}:v${version}`.slice(0, 64),
				// The depth orders managers first; real feed positions are far above, so live events apply after.
				seq: String(depth.get(agent.id) ?? 0),
				type: 'agent.updated',
				version: 1,
				occurredAt: agent.updatedAt ?? new Date().toISOString(),
				tenantId: context.connection.ewTenantId,
				organizationId: context.everWorksOrganizationId,
				aggregate: { type: 'agent', id: agent.id, version: agent.version ?? null },
				data: agent
			} as unknown as EverWorksEventEnvelope;
			const { duplicate } = await this.inbound.record(context.connection, envelope, 'initial');
			if (duplicate) totals.duplicates++;
			else totals.queued++;
		}
		return totals;
	}

	/** `GET /mappings/:id/agents`: the linked agent employees. */
	async list(integrationTenantId: ID, organizationId?: ID): Promise<Array<{ ewAgentId: string; employeeId: ID; name: string | null; status: string | null; isActive: boolean }>> {
		const context = await this.contexts.forRequest(integrationTenantId, organizationId);
		// An agent that turned private keeps its row (state `unlinked`) but is no longer a linked agent.
		const links = (await this.links.list(context.integrationTenantId, EverWorksLinkType.AGENT)).filter((link) => link.state !== EverWorksLinkState.UNLINKED);
		if (!links.length) return [];
		const employees = await this.dataSource.getRepository(Employee).find({
			where: links.map((l) => ({ id: l.gauzyId, tenantId: context.tenantId })),
			withDeleted: true
		});
		return links.map((link) => {
			const snapshot = this.links.snapshot<{ name: string; status: string }>(link);
			const employee = employees.find((e) => e.id === link.gauzyId);
			return { ewAgentId: link.ewId, employeeId: link.gauzyId as ID, name: snapshot.name ?? null, status: snapshot.status ?? null, isActive: !!employee?.isActive };
		});
	}

	/** Inbound handler: `agent.created/updated/status_changed/archived/deleted/visibility_changed`. */
	async apply(envelope: EverWorksEventEnvelope, applyContext: EverWorksApplyContext): Promise<EverWorksApplyOutcome> {
		const context = envelope.organizationId
			? await this.contexts.forEverWorksOrganization(applyContext.connection, envelope.organizationId)
			: null;
		if (!context) return { status: 'skipped', message: 'no mapping for the Ever Works organization' };
		if (!context.isEnabled) return { status: 'skipped', message: 'the mapping is disabled' };
		if (context.directions.agents === 'off') return { status: 'skipped', message: 'agents are not synced' };
		const data = envelope.data as unknown as EverWorksAgent & { visibility?: string };
		const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.AGENT, envelope.aggregate.id);
		if (link && link.ewVersion != null && envelope.aggregate.version != null && envelope.aggregate.version <= link.ewVersion) {
			return { status: 'skipped', message: 'already applied (version)' };
		}
		const version = envelope.aggregate.version ?? null;
		if (envelope.type === 'agent.visibility_changed' && data.visibility === 'private') {
			if (link) {
				// The notice's version stays on the ended link (a tombstone): an older public state of the agent (a late
				// webhook, an import listed before it turned private) is skipped by the version check (D11, review F19).
				if (version != null) {
					await this.links.record({
						tenantId: context.tenantId,
						organizationId: context.organizationId,
						integrationTenantId: context.integrationTenantId,
						entityType: EverWorksLinkType.AGENT,
						gauzyId: link.gauzyId as ID,
						ewId: envelope.aggregate.id,
						ewVersion: version,
						direction: 'inbound',
						state: EverWorksLinkState.UNLINKED
					});
				}
				await this.links.unlink(link, NO_LONGER_SHARED);
			}
			return { status: 'skipped', message: 'agent turned private: no longer synced' };
		}
		const archived = envelope.type === 'agent.deleted' || envelope.type === 'agent.archived' || data.deleted === true;
		let agent: EverWorksAgent = { ...data, id: envelope.aggregate.id, version: envelope.aggregate.version, ...(archived ? { status: 'archived' } : {}) };
		if (!link || link.state === EverWorksLinkState.UNLINKED) {
			// An agent not linked yet, or ended as private (any event newer than its tombstone: shared again, a resync),
			// is read from Ever Works first and applied as it is now. Ever Works never answers a private agent, so an
			// event or list entry older than a private notice Gauzy had nothing to end for never brings it in.
			const current = await this.fetchAgent(context, envelope.aggregate.id);
			if (!current) return { status: 'skipped', message: 'the agent is not visible in Ever Works (private or gone)' };
			if (current.visibility !== undefined && !isSyncedVisibility(current.visibility)) {
				return { status: 'skipped', message: 'the agent is not visible in Ever Works (private or gone)' };
			}
			agent = { ...current, id: envelope.aggregate.id, version: current.version ?? envelope.aggregate.version };
		}
		await this.provision(context, agent);
		return { status: 'applied' };
	}

	/** The agent as Ever Works serves it to the integration now, or `null` (private or gone: 404). */
	private async fetchAgent(context: EverWorksMappingContext, agentId: string): Promise<EverWorksAgent | null> {
		try {
			return await this.connections.client(context.connection, context.everWorksOrganizationSlug).request<EverWorksAgent>('GET', `/agents/${encodeURIComponent(agentId)}`);
		} catch (error) {
			if (error instanceof EverWorksApiError && error.status === 404) return null;
			throw error;
		}
	}

	/** Creates or updates the agent employee of one Ever Works agent, and records its link. */
	async provision(context: EverWorksMappingContext, agent: EverWorksAgent): Promise<EverWorksAgentResult> {
		const archived = agent.status === 'archived' || agent.deleted === true;
		const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.AGENT, agent.id);
		const reportsTo = agent.reportsToAgentId
			? await this.links.byEw(context.integrationTenantId, EverWorksLinkType.AGENT, agent.reportsToAgentId)
			: null;
		const imageUrl = agent.avatar?.mode === 'image' && agent.avatar.url && /^https:\/\//.test(agent.avatar.url) ? agent.avatar.url : undefined;
		// A field Ever Works cleared is cleared here too: explicit `null`s (the profile writer skips only
		// `undefined`), so the managed profile always follows Ever Works.
		const profile = {
			source: EmployeeAgentSourceEnum.EVER_WORKS,
			externalId: agent.id,
			slug: agent.slug,
			title: agent.title ?? null,
			capabilities: agent.capabilities ? [agent.capabilities] : [],
			status: archived ? 'archived' : agent.status,
			scope: agent.scope,
			scopeTargetId: agent.scopeTargetId,
			reportsToEmployeeId: (reportsTo?.gauzyId as ID) ?? null,
			modelId: agent.modelId ?? null,
			avatarUrl: imageUrl ?? null,
			lastRunAt: agent.lastRunAt ? new Date(agent.lastRunAt) : null,
			managedExternally: true,
			externalUrl: agent.webUrl && /^https:\/\//.test(agent.webUrl) ? agent.webUrl : null
		} as unknown as Partial<IEmployeeAgentProfileInput>;
		let employee: Employee | null = link
			? await this.dataSource.getRepository(Employee).findOne({ where: { id: link.gauzyId, tenantId: context.tenantId }, withDeleted: true })
			: null;
		let created = false;
		if (!employee) {
			const input: IAgentEmployeeCreateInput = {
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				name: agent.name,
				email: `agent-${agent.id.toLowerCase()}@${agentEmailDomain()}`,
				imageUrl,
				shortDescription: agent.title ?? undefined,
				profile: profile as IEmployeeAgentProfileInput
			};
			const result = await this.employees().createAgentEmployee(input);
			employee = result.employee as Employee;
			created = result.created;
		} else {
			if (employee.userId) {
				await this.dataSource.getRepository(User).update({ id: employee.userId }, { firstName: agent.name, imageUrl: imageUrl ?? null } as never);
			}
			await this.profiles().upsertForEmployee(employee, profile);
		}
		const employeeId = employee.id as ID;
		await this.dataSource
			.getRepository(Employee)
			.update({ id: employeeId }, archived ? ({ isActive: false, isArchived: true } as never) : ({ isActive: true, isArchived: false, short_description: (agent.title ?? '').slice(0, 200) || null } as never));
		await this.links.record({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			entityType: EverWorksLinkType.AGENT,
			gauzyId: employeeId,
			ewId: agent.id,
			ewVersion: agent.version ?? null,
			ewUpdatedAt: agent.updatedAt ?? null,
			snapshot: { name: agent.name, slug: agent.slug, title: agent.title ?? null, status: archived ? 'archived' : agent.status },
			ewOnly: { teamIds: agent.teamIds ?? [], scope: agent.scope, scopeTargetId: agent.scopeTargetId },
			direction: 'inbound'
		});
		if (created) this.logger.log(`Agent ${agent.id} provisioned as employee ${employeeId} (organization ${context.organizationId}).`);
		return { ewAgentId: agent.id, employeeId, created, archived };
	}

	private employees(): EmployeeService {
		const service = this.moduleRef.get(EmployeeService, { strict: false });
		if (!service?.createAgentEmployee) throw new ServiceUnavailableException('Agent provisioning is not available in this process.');
		return service;
	}

	private profiles(): EmployeeAgentProfileService {
		const service = this.moduleRef.get(EmployeeAgentProfileService, { strict: false });
		if (!service?.upsertForEmployee) throw new ServiceUnavailableException('Agent profiles are not available in this process.');
		return service;
	}
}

/**
 * How deep each agent sits in its reporting chain (0 = reports to no imported agent), so managers are
 * applied before the agents that report to them; a cycle is cut where it closes.
 */
export function reportingDepths(agents: ReadonlyArray<Pick<EverWorksAgent, 'id' | 'reportsToAgentId'>>): Map<string, number> {
	const managerOf = new Map(agents.map((agent) => [agent.id, agent.reportsToAgentId ?? null]));
	const depths = new Map<string, number>();
	for (const agent of agents) {
		const chain = new Set<string>([agent.id]);
		let depth = 0;
		let manager = managerOf.get(agent.id) ?? null;
		while (manager && managerOf.has(manager) && !chain.has(manager)) {
			chain.add(manager);
			depth++;
			manager = managerOf.get(manager) ?? null;
		}
		depths.set(agent.id, depth);
	}
	return depths;
}
