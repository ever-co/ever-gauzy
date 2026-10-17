import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import { catchError, map, mergeMap, switchMap, toArray } from 'rxjs/operators';
import {
	EmployeeAgentSourceEnum,
	EmployeeKindEnum,
	ID,
	IEmployee,
	IEmployeeAgentProfile,
	IOrganizationTeam,
	IPagination,
	IUser,
	IUserOrganization
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

/** A person, team or agent a mailbox setting can name. */
export interface IInboxDirectoryEntry {
	id: ID;
	name: string;
	/** An email address, for telling two people of the same name apart. */
	detail?: string | null;
}

/** Agent profiles read at the same time (one request each; every agent is read, a few at a time). */
export const INBOX_DIRECTORY_PROFILE_CONCURRENCY = 6;

/** A user's name as the Settings pages show it: first and last name, else the email. */
export function userName(user: Pick<IUser, 'firstName' | 'lastName' | 'email' | 'name'> | null | undefined): string {
	const name = [user?.firstName, user?.lastName].filter((part) => !!part && String(part).trim()).join(' ');
	return name || user?.name || user?.email || '';
}

function byName(a: IInboxDirectoryEntry, b: IInboxDirectoryEntry): number {
	return a.name.localeCompare(b.name);
}

/**
 * The organization's people, teams and Ever Works agents, for the mailbox pickers of Settings → Inbox → Mailboxes:
 * the owner of a new mailbox (an employee or a team), the members of a shared one (users of the organization), and
 * the Ever Works agent a mailbox hands its mail to (G-P4-6).
 *
 * Read through Gauzy's own routes (`/api/user-organization`, `/api/employee`, `/api/organization-team`), so each list
 * needs the permission its route needs; a page shows what it could read and says when a list is not available.
 */
@Injectable({ providedIn: 'root' })
export class InboxDirectoryService {
	private readonly http = inject(HttpClient);

	/** The active users of the organization (mailbox members are users). */
	users(organizationId: ID, tenantId: ID): Observable<IInboxDirectoryEntry[]> {
		return this.http
			.get<IPagination<IUserOrganization>>(`${API_PREFIX}/user-organization`, {
				params: toParams({ relations: ['user'], where: { organizationId, tenantId } })
			})
			.pipe(
				map((page) =>
					(page?.items ?? [])
						.filter((membership) => membership.isActive !== false && !!membership.userId)
						.map((membership) => ({
							id: membership.userId as ID,
							name: userName(membership.user) || (membership.userId as string),
							detail: membership.user?.email ?? null
						}))
						.sort(byName)
				)
			);
	}

	/** The organization's (human) employees, the owners of personal mailboxes. */
	employees(organizationId: ID, tenantId: ID): Observable<IInboxDirectoryEntry[]> {
		return this.employeesOfKind(EmployeeKindEnum.HUMAN, organizationId, tenantId).pipe(
			map((employees) =>
				employees
					.map((employee) => ({
						id: employee.id as ID,
						name: userName(employee.user) || employee.fullName || (employee.id as string),
						detail: employee.user?.email ?? null
					}))
					.sort(byName)
			)
		);
	}

	/** The organization's teams. */
	teams(organizationId: ID, tenantId: ID): Observable<IInboxDirectoryEntry[]> {
		return this.http
			.get<IPagination<IOrganizationTeam>>(`${API_PREFIX}/organization-team`, {
				params: toParams({ where: { organizationId, tenantId } })
			})
			.pipe(
				map((page) =>
					(page?.items ?? [])
						.map((team) => ({ id: team.id as ID, name: team.name || (team.id as string) }))
						.sort(byName)
				)
			);
	}

	/**
	 * The organization's Ever Works agents: agent employees whose agent profile comes from Ever Works (the ones the
	 * integration pairs). The value a mailbox stores (`settings.everWorksAgentId`) is the agent employee's Gauzy id,
	 * which the integration resolves to the Ever Works agent.
	 */
	everWorksAgents(organizationId: ID, tenantId: ID): Observable<IInboxDirectoryEntry[]> {
		return this.employeesOfKind(EmployeeKindEnum.AGENT, organizationId, tenantId).pipe(
			switchMap((agents) => {
				const listed = agents.filter((agent) => !!agent.id);
				if (listed.length === 0) return of([] as IInboxDirectoryEntry[]);
				return from(listed).pipe(
					mergeMap(
						(agent) =>
							this.http
								.get<IEmployeeAgentProfile>(
									`${API_PREFIX}/employee/${encodeURIComponent(agent.id as string)}/agent-profile`
								)
								.pipe(
									map((profile) => ({ agent, profile })),
									// No profile (404) or not readable: not an Ever Works agent for this list.
									catchError(() => of({ agent, profile: null as IEmployeeAgentProfile | null }))
								),
						INBOX_DIRECTORY_PROFILE_CONCURRENCY
					),
					toArray(),
					map((rows) =>
						rows
							.filter(({ profile }) => profile?.source === EmployeeAgentSourceEnum.EVER_WORKS)
							.map(({ agent, profile }) => ({
								id: agent.id as ID,
								name: profile?.title || userName(agent.user) || agent.fullName || (agent.id as string),
								detail: profile?.slug ?? null
							}))
							.sort(byName)
					)
				);
			})
		);
	}

	private employeesOfKind(kind: EmployeeKindEnum, organizationId: ID, tenantId: ID): Observable<IEmployee[]> {
		return this.http
			.get<IPagination<IEmployee>>(`${API_PREFIX}/employee`, {
				params: toParams({ kind, relations: ['user'], where: { organizationId, tenantId } })
			})
			.pipe(map((page) => page?.items ?? []));
	}
}
