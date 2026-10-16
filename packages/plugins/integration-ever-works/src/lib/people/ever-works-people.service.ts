import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { EmployeeKindEnum, ID } from '@gauzy/contracts';
import { Employee } from '@gauzy/core';
import { EverWorksClient } from '../client/ever-works-client';
import { EverWorksListPage } from '../client/ever-works-client.types';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import { EverWorksMappingContext, EverWorksMappingContextService } from '../mapping/ever-works-mapping-context.service';
import { EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { EverWorksLinkService } from '../sync/links/ever-works-link.service';

/** An Ever Works organization member (contract v1 `GET /members`). */
export interface EverWorksMember {
	organizationId: string;
	userId: string;
	username: string;
	displayName?: string | null;
	email: string | null;
	emailVerified: boolean;
	avatarUrl: string | null;
	role: string;
	isActive?: boolean;
	joinedAt: string;
	updatedAt: string;
	everIdSubjects: Array<{ issuer: string; subject: string }>;
}

/** One Ever Works member as the People tab shows it. */
export interface EverWorksPersonRow {
	ewUserId: string;
	username: string;
	displayName: string | null;
	email: string | null;
	emailVerified: boolean;
	role: string;
	isActive: boolean;
	/** The Gauzy employee it is linked to, or `null`. */
	linkedEmployeeId: ID | null;
	/** A match the admin may confirm (never applied silently), or `null`. */
	suggestion: { employeeId: ID; reason: 'verified_email' } | null;
}

export interface EverWorksPeopleView {
	members: EverWorksPersonRow[];
	/** Gauzy people of the organization linked to no Ever Works member. */
	unmatchedEmployees: Array<{ employeeId: ID; name: string; email: string | null }>;
}

/** The admin's decisions on the People tab. */
export interface EverWorksPeopleDecision {
	links?: Array<{ ewUserId: string; employeeId: ID }>;
	unlinks?: string[];
	acceptSuggestions?: boolean;
}

/**
 * People matching (plan 01 §3, G-P1-6): Ever Works organization members ↔ Gauzy employees, linked as
 * `MEMBER` (EW user id ↔ G employee id).
 *
 * - **Ever ID**: Gauzy stores no Ever ID subjects yet (no `external_identity`), so no automatic link
 *   happens today; the member's `everIdSubjects` are kept for when it does.
 * - **Verified email**: an exact, case-insensitive match of a verified Ever Works email with a Gauzy
 *   person's email is a **suggestion**; the admin confirms it (one by one or "accept all").
 * - **No match**: the admin links by hand or leaves the member unmapped. Agents are never people.
 *
 * Nothing is linked silently and nothing is deleted: unlinking only removes the pairing.
 */
@Injectable()
export class EverWorksPeopleService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly contexts: EverWorksMappingContextService,
		private readonly connections: EverWorksConnectionService,
		private readonly links: EverWorksLinkService
	) {}

	/** `GET /mappings/:id/people`. */
	async people(integrationTenantId: ID, organizationId?: ID): Promise<EverWorksPeopleView> {
		const context = await this.contexts.forRequest(integrationTenantId, organizationId);
		return this.view(context, await this.members(context));
	}

	/** `PUT /mappings/:id/people`: confirms links, removes links, or accepts every suggestion. */
	async decide(integrationTenantId: ID, decision: EverWorksPeopleDecision, organizationId?: ID): Promise<EverWorksPeopleView> {
		const context = await this.contexts.forRequest(integrationTenantId, organizationId);
		const members = await this.members(context);
		const byUser = new Map(members.map((m) => [m.userId, m]));
		const pairs = [...(decision.links ?? [])];
		if (decision.acceptSuggestions) {
			for (const row of (await this.view(context, members)).members) {
				if (row.suggestion && !row.linkedEmployeeId) pairs.push({ ewUserId: row.ewUserId, employeeId: row.suggestion.employeeId });
			}
		}
		const employees = await this.people$(context, pairs.map((p) => p.employeeId));
		for (const pair of pairs) {
			if (!byUser.has(pair.ewUserId)) throw new BadRequestException(`${pair.ewUserId} is not a member of the mapped Ever Works organization.`);
			if (!employees.has(pair.employeeId)) throw new BadRequestException(`${pair.employeeId} is not an active person of this organization.`);
		}
		const seenUsers = new Set<string>();
		const seenEmployees = new Set<string>();
		for (const pair of pairs) {
			if (seenUsers.has(pair.ewUserId) || seenEmployees.has(pair.employeeId)) {
				throw new BadRequestException('Each member and each employee can be linked once.');
			}
			seenUsers.add(pair.ewUserId);
			seenEmployees.add(pair.employeeId);
		}
		await this.dataSource.transaction(async (manager) => {
			for (const ewUserId of decision.unlinks ?? []) {
				const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.MEMBER, ewUserId, manager);
				if (link) await this.links.remove(link, manager);
			}
			for (const pair of pairs) {
				// A pairing replaces the previous one of either side.
				for (const stale of [
					await this.links.byEw(context.integrationTenantId, EverWorksLinkType.MEMBER, pair.ewUserId, manager),
					await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.MEMBER, pair.employeeId, manager)
				]) {
					if (stale) await this.links.remove(stale, manager);
				}
				const member = byUser.get(pair.ewUserId) as EverWorksMember;
				await this.links.record(
					{
						tenantId: context.tenantId,
						organizationId: context.organizationId,
						integrationTenantId: context.integrationTenantId,
						entityType: EverWorksLinkType.MEMBER,
						gauzyId: pair.employeeId,
						ewId: pair.ewUserId,
						ewUpdatedAt: member.updatedAt,
						snapshot: { email: member.email, username: member.username },
						ewOnly: { everIdSubjects: member.everIdSubjects ?? [], role: member.role },
						direction: 'inbound'
					},
					manager
				);
			}
		});
		return this.view(context, members);
	}

	/** Every member of the mapped Ever Works organization (all pages). */
	async members(context: EverWorksMappingContext): Promise<EverWorksMember[]> {
		const client: EverWorksClient = this.connections.client(context.connection, context.everWorksOrganizationSlug);
		const members: EverWorksMember[] = [];
		let cursor: string | null = null;
		for (let page = 0; page < 100; page++) {
			const result: EverWorksListPage<EverWorksMember> = await client.request('GET', '/members', { query: { limit: 500, cursor } });
			members.push(...(result.data ?? []));
			if (!result.hasMore || !result.nextCursor) break;
			cursor = result.nextCursor;
		}
		return members.filter((m) => !(m as { deleted?: boolean }).deleted);
	}

	private async view(context: EverWorksMappingContext, members: EverWorksMember[]): Promise<EverWorksPeopleView> {
		const links = await this.links.list(context.integrationTenantId, EverWorksLinkType.MEMBER);
		const linkByUser = new Map(links.map((l) => [l.ewId, l.gauzyId as ID]));
		const linkedEmployees = new Set(links.map((l) => l.gauzyId));
		const people = await this.people$(context);
		const byEmail = new Map<string, ID>();
		for (const [id, person] of people) if (person.email) byEmail.set(person.email.toLowerCase(), id);
		const rows: EverWorksPersonRow[] = members.map((m) => {
			const linkedEmployeeId = linkByUser.get(m.userId) ?? null;
			const match = !linkedEmployeeId && m.emailVerified && m.email ? byEmail.get(m.email.toLowerCase()) : undefined;
			return {
				ewUserId: m.userId,
				username: m.username,
				displayName: m.displayName ?? null,
				email: m.email,
				emailVerified: !!m.emailVerified,
				role: m.role,
				isActive: m.isActive !== false,
				linkedEmployeeId,
				suggestion: match && !linkedEmployees.has(match) ? { employeeId: match, reason: 'verified_email' } : null
			};
		});
		return {
			members: rows,
			// A suggestion is not a pairing: a suggested person stays unmatched until the admin confirms it.
			unmatchedEmployees: [...people.entries()]
				.filter(([id]) => !linkedEmployees.has(id))
				.map(([employeeId, p]) => ({ employeeId, name: p.name, email: p.email }))
		};
	}

	/** The active people (not agents) of the organization, optionally only the given ones. */
	private async people$(context: EverWorksMappingContext, only?: ID[]): Promise<Map<ID, { name: string; email: string | null }>> {
		if (only && !only.length) return new Map();
		const rows = await this.dataSource.getRepository(Employee).find({
			where: {
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				isActive: true,
				isArchived: false,
				...(only ? { id: In(only) } : {})
			},
			relations: { user: true }
		});
		const result = new Map<ID, { name: string; email: string | null }>();
		for (const row of rows) {
			if ((row as Employee & { kind?: string }).kind === EmployeeKindEnum.AGENT) continue;
			const user = row.user;
			const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || (row.id as string);
			result.set(row.id as ID, { name, email: user?.email ?? null });
		}
		return result;
	}
}
