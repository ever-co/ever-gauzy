import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource, EntityManager, In } from 'typeorm';
import {
	EmployeeKindEnum,
	ICreateEmailInvitesInput,
	ICreateEmailInvitesOutput,
	ID,
	InvitationTypeEnum,
	InviteStatusEnum,
	PermissionsEnum,
	RolesEnum
} from '@gauzy/contracts';
import { Employee, IntegrationSetting, Invite, InviteBulkCreateCommand, RequestContext, Role } from '@gauzy/core';
import { EverWorksApiError, EverWorksClient } from '../client/ever-works-client';
import { EverWorksListPage } from '../client/ever-works-client.types';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import { EverWorksSettingName } from '../ever-works-setting.enum';
import { EverWorksMappingContext, EverWorksMappingContextService } from '../mapping/ever-works-mapping-context.service';
import { EVER_WORKS_INBOX_AGGREGATE } from '../inbox/ever-works-inbox.service';
import { EverWorksEntityLink, EverWorksInboundEvent, EverWorksInboundStatus, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { everWorksUserOfGauzyUser } from '../sync/ever-works-actor';
import { EverWorksLinkService } from '../sync/links/ever-works-link.service';
import { DEFERRED_INBOX_SCAN, EverWorksDeferredInboxRow, deferredInboxOf, requeueDeferredInbox } from './ever-works-deferred-inbox';
import { EVER_ID_ACCOUNT_TABLE, EverIdIdentity, EverWorksMatchSource, everIdKey, everIdMatches } from './ever-works-ever-id';

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
	/** How the pairing was made (`null` while unpaired); a pairing older than this record reads `manual`. */
	matchedBy: EverWorksMatchSource | null;
	/**
	 * A match the admin may confirm, or `null`: the same Ever ID (only for a member whose automatic Ever ID pairing
	 * an admin undid), else a verified e-mail. Never applied silently.
	 */
	suggestion: { employeeId: ID; reason: 'ever_id' | 'verified_email' } | null;
	/** A Gauzy invitation still pending for the member's e-mail ("invite to Gauzy"), or `null`. */
	gauzyInvite: { inviteId: ID; expireDate: Date | null } | null;
}

export interface EverWorksPeopleView {
	members: EverWorksPersonRow[];
	/** Gauzy people of the organization linked to no Ever Works member. */
	unmatchedEmployees: Array<{ employeeId: ID; name: string; email: string | null }>;
	/**
	 * Ever Works inbox items addressed to members not paired yet: not delivered, they wait (deferred) until the
	 * member is paired — pairing makes them due at once.
	 */
	deferredInbox: EverWorksDeferredInboxRow[];
}

/** How many e-mails one pending-invitation query names at most (and Ever ID subjects one identity query names). */
const PENDING_INVITE_CHUNK = 500;
/** How long an invitation waits for another one of the same e-mail (then 409), and how often Postgres retries. */
const INVITE_LOCK_WAIT_MS = 30_000;
const INVITE_LOCK_POLL_MS = 200;

/**
 * "Invite to Gauzy": the Ever Works member to invite and, optionally, the role (the tenant's Employee role, the only
 * one whose acceptance creates an employee the People tab can pair).
 */
export interface EverWorksInviteToGauzyInput {
	ewUserId: string;
	roleId?: ID;
}

/** What "invite to Gauzy" did: a new invitation was sent, or one still pending for that e-mail is answered again. */
export interface EverWorksInviteToGauzyResult {
	status: 'invited' | 'pending';
	inviteId: ID;
	email: string;
	roleId: ID;
	expireDate: Date | null;
}

/** "Invite to Ever Works": the Gauzy person to invite. */
export interface EverWorksInviteToEverWorksInput {
	employeeId: ID;
}

/** Ever Works' answer to `POST /members/invite` (contract v1-draft.15, `member-invite-result.schema.json`). */
export interface EverWorksMemberInviteResult {
	status: 'invited' | 'pending' | 'already_member' | 'added';
	invitation: { id: string; email: string; role: string; status: string; expiresAt: string; createdAt: string } | null;
	userId: string | null;
}

/** What "invite to Ever Works" did, as the People tab shows it. */
export interface EverWorksInviteToEverWorksResult {
	/** `invited` (emailed), `pending` (answered again), `already_member`, or `added` (joined the roster directly). */
	status: EverWorksMemberInviteResult['status'];
	email: string;
	invitationId: string | null;
	expiresAt: string | null;
	/** The Ever Works member (`already_member`, `added`): the People tab then suggests the pairing. */
	ewUserId: string | null;
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
 * - **Ever ID** (first): a member whose Ever ID (`everIdSubjects`, Ever Works `external_identities`) is the Ever ID
 *   of exactly one Gauzy person (`zitadel_account`, written by the Ever ID sign-in plugin only once the person
 *   proved both sides) is **paired automatically** when the People tab is read (plan 01 §3 step 1, D5). An admin
 *   who undoes such a pairing is not overruled: the member is declined (`PEOPLE_EVER_ID_DECLINED`) and only suggested
 *   from then on, until an admin pairs them again. Without Ever ID data on either side, nothing happens here.
 * - **Verified email**: an exact, case-insensitive match of a verified Ever Works email with a Gauzy
 *   person's email is a **suggestion**; the admin confirms it (one by one or "accept all").
 * - Every pairing records how it was made (`matchedBy`: `ever_id`, `verified_email` or `manual`).
 * - **No match**: the admin links by hand, invites the member to Gauzy (the platform's own employee invitation;
 *   accepting it is the invitee's step, and pairing stays the admin's), invites a Gauzy person to Ever Works (the
 *   Ever Works organization invitation, `POST /members/invite`), or leaves them unmapped. Agents are never people.
 *
 * Nothing but an Ever ID match is linked without the admin, and nothing is deleted: unlinking only removes the
 * pairing.
 */
@Injectable()
export class EverWorksPeopleService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly contexts: EverWorksMappingContextService,
		private readonly connections: EverWorksConnectionService,
		private readonly links: EverWorksLinkService,
		private readonly commandBus: CommandBus
	) {}

	/** Invitations in flight per organization and e-mail (see `withInviteClaim`). */
	private readonly inviteClaims = new Map<string, Promise<unknown>>();

	/** `GET /mappings/:id/people`: pairs the Ever ID matches first (see the class comment), then lists. */
	async people(integrationTenantId: ID, organizationId?: ID): Promise<EverWorksPeopleView> {
		const context = await this.contexts.forRequest(integrationTenantId, organizationId);
		const members = await this.members(context);
		await this.linkEverIdMatches(context, members);
		return this.view(context, members);
	}

	/** `PUT /mappings/:id/people`: confirms links, removes links, or accepts every suggestion. */
	async decide(integrationTenantId: ID, decision: EverWorksPeopleDecision, organizationId?: ID): Promise<EverWorksPeopleView> {
		const context = await this.contexts.forRequest(integrationTenantId, organizationId);
		const members = await this.members(context);
		const byUser = new Map(members.map((m) => [m.userId, m]));
		const pairs = [...(decision.links ?? [])];
		// What the tab suggests now: an accepted suggestion records its reason, any other pairing is `manual`.
		const suggested = new Map<string, { employeeId: ID; reason: 'ever_id' | 'verified_email' }>();
		if (pairs.length || decision.acceptSuggestions) {
			for (const row of (await this.view(context, members)).members) {
				if (row.suggestion && !row.linkedEmployeeId) suggested.set(row.ewUserId, row.suggestion);
			}
		}
		if (decision.acceptSuggestions) {
			for (const [ewUserId, suggestion] of suggested) {
				if (!pairs.some((pair) => pair.ewUserId === ewUserId)) pairs.push({ ewUserId, employeeId: suggestion.employeeId });
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
			const declined = await this.declinedEverId(context, manager);
			const declinedBefore = JSON.stringify([...declined].sort());
			for (const ewUserId of decision.unlinks ?? []) {
				const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.MEMBER, ewUserId, manager);
				if (!link) continue;
				// Undoing an automatic Ever ID pairing is the admin's call: it is not made again by itself.
				if (matchedByOf(link) === 'ever_id') declined.add(ewUserId);
				await this.links.remove(link, manager);
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
				const suggestion = suggested.get(pair.ewUserId);
				const matchedBy: EverWorksMatchSource = suggestion && suggestion.employeeId === pair.employeeId ? suggestion.reason : 'manual';
				declined.delete(pair.ewUserId);
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
						ewOnly: { everIdSubjects: member.everIdSubjects ?? [], role: member.role, matchedBy },
						direction: 'inbound'
					},
					manager
				);
			}
			if (JSON.stringify([...declined].sort()) !== declinedBefore) await this.saveDeclinedEverId(context, declined, manager);
		});
		await this.wakeDeferredInbox(context, new Set(pairs.map((pair) => pair.ewUserId)));
		return this.view(context, members);
	}

	/**
	 * Their inbox items waited for this pairing: deliver them now rather than at the next hourly retry. Every deferred
	 * event is woken (page by page, not only the newest the tab lists), so none keeps an older one waiting.
	 */
	private async wakeDeferredInbox(context: EverWorksMappingContext, paired: ReadonlySet<string>): Promise<void> {
		if (!paired.size) return;
		const repository = this.dataSource.getRepository(EverWorksInboundEvent);
		for (let skip = 0; ; skip += DEFERRED_INBOX_SCAN) {
			const page = await this.deferredInboxEvents(context, skip);
			await requeueDeferredInbox(repository, page, paired);
			if (page.length < DEFERRED_INBOX_SCAN) break;
		}
	}

	// ── Ever ID ────────────────────────────────────────────────────────────────────────────────────

	/**
	 * Pairs the Ever ID matches (plan 01 §3 step 1): an unpaired, active member whose Ever ID is the Ever ID of exactly
	 * one unpaired person of the organization, unless an admin declined that member. Each pairing is re-checked in its
	 * own transaction (two readers of the tab at once pair once: the loser finds the link and leaves it).
	 */
	private async linkEverIdMatches(context: EverWorksMappingContext, members: EverWorksMember[]): Promise<void> {
		const links = await this.links.list(context.integrationTenantId, EverWorksLinkType.MEMBER);
		const pairedUsers = new Set(links.map((l) => l.ewId));
		const pairedPeople = new Set(links.map((l) => l.gauzyId as ID));
		const unpaired = members.filter((m) => !pairedUsers.has(m.userId) && m.isActive !== false && m.everIdSubjects?.length);
		if (!unpaired.length) return;
		const declined = await this.declinedEverId(context);
		const candidates = unpaired.filter((m) => !declined.has(m.userId));
		const matches = await this.everIdMatchesOf(context, candidates, pairedPeople);
		const paired = new Set<string>();
		const byUser = new Map(candidates.map((m) => [m.userId, m]));
		for (const [ewUserId, employeeId] of matches) {
			const member = byUser.get(ewUserId) as EverWorksMember;
			try {
				const linked = await this.dataSource.transaction(async (manager) => {
					if (
						(await this.links.byEw(context.integrationTenantId, EverWorksLinkType.MEMBER, ewUserId, manager)) ||
						(await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.MEMBER, employeeId, manager))
					) {
						return false;
					}
					await this.links.record(
						{
							tenantId: context.tenantId,
							organizationId: context.organizationId,
							integrationTenantId: context.integrationTenantId,
							entityType: EverWorksLinkType.MEMBER,
							gauzyId: employeeId,
							ewId: ewUserId,
							ewUpdatedAt: member.updatedAt,
							snapshot: { email: member.email, username: member.username },
							ewOnly: { everIdSubjects: member.everIdSubjects ?? [], role: member.role, matchedBy: 'ever_id' },
							direction: 'inbound'
						},
						manager
					);
					return true;
				});
				if (linked) paired.add(ewUserId);
			} catch (error) {
				// A concurrent reader paired them first (the link table's unique keys refused this one): nothing to do.
				if (!(await this.links.byEw(context.integrationTenantId, EverWorksLinkType.MEMBER, ewUserId))) throw error;
			}
		}
		await this.wakeDeferredInbox(context, paired);
	}

	/**
	 * The Ever ID matches of these members among the people of the organization not in `pairedPeople` (see
	 * {@link everIdMatches}); empty when no member carries an Ever ID or Gauzy has no Ever ID links.
	 */
	private async everIdMatchesOf(context: EverWorksMappingContext, members: EverWorksMember[], pairedPeople: ReadonlySet<ID>): Promise<Map<string, ID>> {
		const identities = members.flatMap((m) => m.everIdSubjects ?? []);
		if (!identities.length) return new Map();
		const usersByIdentity = await this.everIdUsers(context, identities);
		if (!usersByIdentity.size) return new Map();
		const personOfUser = new Map<string, ID>();
		for (const [employeeId, person] of await this.people$(context)) {
			if (person.userId && !pairedPeople.has(employeeId)) personOfUser.set(person.userId, employeeId);
		}
		return everIdMatches(members, usersByIdentity, personOfUser);
	}

	/**
	 * The tenant's Gauzy users of these Ever ID identities, by {@link everIdKey}, from the Ever ID sign-in links
	 * (`zitadel_account`, read as a plain table: the sign-in plugin need not be loaded). Empty when the table cannot be
	 * read: then there is no Ever ID data to match on.
	 */
	private async everIdUsers(context: EverWorksMappingContext, identities: ReadonlyArray<EverIdIdentity>): Promise<Map<string, Set<string>>> {
		const wanted = new Set(identities.map((identity) => everIdKey(identity)));
		const subjects = [...new Set(identities.map((identity) => identity.subject).filter((subject) => !!subject))];
		const escape = (name: string) => this.dataSource.driver.escape(name);
		const column = (name: string) => `${escape('account')}.${escape(name)}`;
		const result = new Map<string, Set<string>>();
		for (let i = 0; i < subjects.length; i += PENDING_INVITE_CHUNK) {
			let rows: Array<{ issuer: string; subject: string; userId: string }>;
			try {
				rows = await this.dataSource
					.createQueryBuilder()
					.select(column('issuer'), 'issuer')
					.addSelect(column('subject'), 'subject')
					.addSelect(column('userId'), 'userId')
					.from(EVER_ID_ACCOUNT_TABLE, 'account')
					.where(`${column('tenantId')} = :tenantId`, { tenantId: context.tenantId })
					.andWhere(`${column('subject')} IN (:...subjects)`, { subjects: subjects.slice(i, i + PENDING_INVITE_CHUNK) })
					.andWhere(`${column('deletedAt')} IS NULL`)
					.getRawMany();
			} catch {
				return new Map();
			}
			for (const row of rows) {
				const key = everIdKey(row);
				if (!wanted.has(key) || !row.userId) continue;
				if (!result.has(key)) result.set(key, new Set());
				result.get(key)?.add(String(row.userId));
			}
		}
		return result;
	}

	/** The members an admin unpaired after Ever ID paired them (never paired again by Ever ID alone). */
	private async declinedEverId(context: EverWorksMappingContext, manager?: EntityManager): Promise<Set<string>> {
		const row = await (manager ?? this.dataSource).getRepository(IntegrationSetting).findOne({
			where: { integrationId: context.integrationTenantId, settingsName: EverWorksSettingName.PEOPLE_EVER_ID_DECLINED } as never
		});
		try {
			const value = row?.settingsValue ? (JSON.parse(row.settingsValue) as unknown) : [];
			return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []);
		} catch {
			return new Set();
		}
	}

	private async saveDeclinedEverId(context: EverWorksMappingContext, declined: ReadonlySet<string>, manager: EntityManager): Promise<void> {
		const repository = manager.getRepository(IntegrationSetting);
		const settingsValue = JSON.stringify([...declined].sort());
		const where = { integrationId: context.integrationTenantId, settingsName: EverWorksSettingName.PEOPLE_EVER_ID_DECLINED };
		const row = await repository.findOne({ where: where as never });
		if (row) {
			await repository.update({ id: row.id } as never, { settingsValue } as never);
			return;
		}
		await repository.save(
			repository.create({ tenantId: context.tenantId, organizationId: context.organizationId, ...where, settingsValue } as never) as never
		);
	}

	/**
	 * `POST /mappings/:id/people/invite-to-gauzy`: invites an Ever Works member who has no Gauzy person yet as an
	 * employee of the mapped organization, through the platform's own invite flow (`InviteBulkCreateCommand`: its
	 * e-mail, its rules on who may invite, and its accept path). Needs the invite permission on top of the
	 * integration's.
	 *
	 * The invitation is for the tenant's Employee role: the accept path creates an employee only for that role (any
	 * other joins as a user with no employee, whom the People tab could never pair), so `roleId` may name only it;
	 * the admin changes the role in Gauzy once the person has joined.
	 *
	 * Only a verified Ever Works e-mail is invited, so the invitation reaches the member and not whoever else typed
	 * that address. A member already paired, or whose e-mail a person of the organization already has (pair them
	 * instead), is refused. An invitation still pending for the e-mail is answered again rather than sent twice, and
	 * overlapping requests for one e-mail are serialised (in this process, and by a session lock on Postgres and
	 * MySQL), so two clicks or two admins send one invitation. Nothing is accepted or paired here: once the invitee
	 * joins, the verified e-mail suggests the pairing.
	 */
	async inviteToGauzy(integrationTenantId: ID, input: EverWorksInviteToGauzyInput, organizationId?: ID): Promise<EverWorksInviteToGauzyResult> {
		if (!RequestContext.hasPermission(PermissionsEnum.ORG_INVITE_EDIT)) {
			throw new ForbiddenException('Inviting people to Gauzy needs the permission to edit invites.');
		}
		const context = await this.contexts.forRequest(integrationTenantId, organizationId);
		const member = (await this.members(context)).find((m) => m.userId === input.ewUserId);
		if (!member) throw new BadRequestException(`${input.ewUserId} is not a member of the mapped Ever Works organization.`);
		if (await this.links.byEw(context.integrationTenantId, EverWorksLinkType.MEMBER, member.userId)) {
			throw new ConflictException('This member is already paired with a Gauzy person.');
		}
		if (member.isActive === false) throw new BadRequestException('This member is deactivated in Ever Works.');
		if (!member.email || !member.emailVerified) {
			throw new BadRequestException('Only a member whose e-mail Ever Works has verified can be invited.');
		}
		const email = member.email;
		const key = email.toLowerCase();
		const roleId = await this.employeeRoleId(context, input.roleId);
		return this.withInviteClaim(`${context.tenantId}:${context.organizationId}:${key}`, async () => {
			for (const [employeeId, person] of await this.people$(context)) {
				if (person.email?.toLowerCase() === key) {
					throw new ConflictException(`A person of this organization already has this e-mail (${employeeId}): pair them instead.`);
				}
			}
			const pending = (await this.pendingInvites(context, [email])).get(key);
			if (pending) {
				if (pending.roleId && pending.roleId !== roleId) {
					throw new ConflictException("An invitation for another role is still pending for this e-mail: revoke it on Gauzy's Invites page first.");
				}
				return { status: 'pending', inviteId: pending.id as ID, email: pending.email, roleId, expireDate: pending.expireDate ?? null };
			}
			const invite = {
				emailIds: [email],
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				roleId,
				inviteType: InvitationTypeEnum.EMPLOYEE,
				fullName: member.displayName || member.username,
				projectIds: [],
				teamIds: [],
				departmentIds: [],
				organizationContactIds: []
			} as unknown as ICreateEmailInvitesInput;
			const output: ICreateEmailInvitesOutput = await this.commandBus.execute(new InviteBulkCreateCommand(invite, RequestContext.getLanguageCode()));
			const created = output?.items?.[0];
			if (!created) throw new ConflictException('Gauzy did not issue an invitation for this e-mail.');
			return { status: 'invited', inviteId: created.id as ID, email: created.email, roleId, expireDate: created.expireDate ?? null };
		});
	}

	/**
	 * `POST /mappings/:id/people/invite-to-ever-works`: invites a Gauzy person who has no Ever Works member yet into
	 * the mapped Ever Works organization through the integration API (`POST /members/invite`, contract v1-draft.15):
	 * Ever Works' own invitation e-mail, as the admin's paired Ever Works user (else as the key's owner), role
	 * `member`. Needs the invite permission on top of the integration's, like "invite to Gauzy".
	 *
	 * Refused: an agent or anyone who is not an active person of the organization, a person without an e-mail, one
	 * already paired, or one whose e-mail a member of the Ever Works organization already has (pair them instead).
	 * Ever Works answers a repeat as the pending invitation, so nothing is sent twice. Nothing is paired here: once
	 * they join, the verified e-mail suggests the pairing.
	 */
	async inviteToEverWorks(integrationTenantId: ID, input: EverWorksInviteToEverWorksInput, organizationId?: ID): Promise<EverWorksInviteToEverWorksResult> {
		if (!RequestContext.hasPermission(PermissionsEnum.ORG_INVITE_EDIT)) {
			throw new ForbiddenException('Inviting people to Ever Works needs the permission to edit invites.');
		}
		const context = await this.contexts.forRequest(integrationTenantId, organizationId);
		const person = (await this.people$(context, [input.employeeId])).get(input.employeeId);
		if (!person) throw new BadRequestException(`${input.employeeId} is not an active person of this organization.`);
		if (await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.MEMBER, input.employeeId)) {
			throw new ConflictException('This person is already paired with an Ever Works member.');
		}
		if (!person.email) throw new BadRequestException('This person has no e-mail to invite.');
		const email = person.email;
		const key = email.toLowerCase();
		const same = (await this.members(context)).find((m) => m.email?.toLowerCase() === key);
		if (same) {
			throw new ConflictException(`A member of the Ever Works organization already has this e-mail (${same.userId}): pair them instead.`);
		}
		const actAsUserId = await everWorksUserOfGauzyUser(this.dataSource, this.links, context, RequestContext.currentUserId() as ID | null);
		const client: EverWorksClient = this.connections.client(context.connection, context.everWorksOrganizationSlug);
		let result: EverWorksMemberInviteResult;
		try {
			result = await client.request<EverWorksMemberInviteResult>('POST', '/members/invite', {
				body: { email, role: 'member', invitedName: person.name },
				actAsUserId
			});
		} catch (error) {
			throw this.inviteError(error);
		}
		return {
			status: result.status,
			email,
			invitationId: result.invitation?.id ?? null,
			expiresAt: result.invitation?.expiresAt ?? null,
			ewUserId: result.userId ?? null
		};
	}

	/** An Ever Works refusal of `POST /members/invite`, as the People tab should read it. */
	private inviteError(error: unknown): unknown {
		if (!(error instanceof EverWorksApiError)) return error;
		if (error.status === 403 && error.code === 'scope_missing') {
			return new ForbiddenException('The Ever Works key cannot invite members: give it the members:write scope (Ever Works, Settings → API keys).');
		}
		if (error.status === 404 || error.status === 405) {
			return new BadRequestException('This Ever Works server cannot invite members yet: it needs integration contract v1-draft.15 (POST /members/invite).');
		}
		if (error.status === 400 || error.status === 409 || error.status === 422) return new BadRequestException(`Ever Works refused the invitation: ${error.message}`);
		return error;
	}

	/**
	 * The tenant's Employee role, the one "invite to Gauzy" invites with (see `inviteToGauzy`). A `roleId` naming any
	 * other role answers 400.
	 */
	private async employeeRoleId(context: EverWorksMappingContext, roleId?: ID): Promise<ID> {
		const role = await this.dataSource.getRepository(Role).findOne({
			where: { tenantId: context.tenantId, name: RolesEnum.EMPLOYEE } as never,
			select: { id: true } as never
		});
		if (!role?.id) throw new BadRequestException('This tenant has no Employee role to invite with.');
		if (roleId && roleId !== role.id) {
			throw new BadRequestException(
				'Only the Employee role makes a Gauzy person the People tab can pair (another role joins without an employee); change the role in Gauzy once they have joined.'
			);
		}
		return role.id as ID;
	}

	/**
	 * The Gauzy invitations still pending (invited, not expired) in the mapped organization for these e-mails, by
	 * lower-cased e-mail (the newest one of each).
	 */
	private async pendingInvites(context: EverWorksMappingContext, emails: ReadonlyArray<string | null>): Promise<Map<string, Invite>> {
		const keys = [...new Set(emails.filter((email): email is string => !!email).map((email) => email.toLowerCase()))];
		const result = new Map<string, Invite>();
		const now = Date.now();
		for (let i = 0; i < keys.length; i += PENDING_INVITE_CHUNK) {
			const rows = await this.dataSource
				.getRepository(Invite)
				.createQueryBuilder('invite')
				.select(['invite.id', 'invite.email', 'invite.expireDate', 'invite.status', 'invite.roleId', 'invite.createdAt'])
				.where('invite.tenantId = :tenantId', { tenantId: context.tenantId })
				.andWhere('invite.organizationId = :organizationId', { organizationId: context.organizationId })
				.andWhere('invite.status = :status', { status: InviteStatusEnum.INVITED })
				.andWhere('LOWER(invite.email) IN (:...emails)', { emails: keys.slice(i, i + PENDING_INVITE_CHUNK) })
				.andWhere('(invite.expireDate IS NULL OR invite.expireDate > :now)', { now: new Date(now) })
				.orderBy('invite.createdAt', 'DESC')
				.getMany();
			for (const row of rows) {
				if (!row.email || (row.expireDate && new Date(row.expireDate).getTime() <= now)) continue;
				const key = row.email.toLowerCase();
				if (!result.has(key)) result.set(key, row);
			}
		}
		return result;
	}

	/**
	 * Runs `fn` with the e-mail claimed: one invitation at a time per organization and e-mail in this process, and
	 * across processes a session lock on Postgres (advisory lock) or MySQL (`GET_LOCK`). SQLite runs in one process.
	 */
	private async withInviteClaim<T>(key: string, fn: () => Promise<T>): Promise<T> {
		const previous = this.inviteClaims.get(key) ?? Promise.resolve();
		const current = previous.catch(() => undefined).then(() => this.withDatabaseLock(`ever-works:invite-gauzy:${key}`, fn));
		this.inviteClaims.set(key, current);
		try {
			return await current;
		} finally {
			if (this.inviteClaims.get(key) === current) this.inviteClaims.delete(key);
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
			// Both dialects wait at most INVITE_LOCK_WAIT_MS, then answer 409: a request stuck while holding the lock
			// (its invitation e-mail, say) must not block every later one for that e-mail, each holding a connection.
			let locked: boolean;
			if (type === 'postgres') {
				locked = false;
				for (const deadline = Date.now() + INVITE_LOCK_WAIT_MS; ; ) {
					const rows = (await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [lockName])) as Array<{ locked: boolean | string | null }>;
					locked = rows?.[0]?.locked === true || rows?.[0]?.locked === 't';
					if (locked || Date.now() >= deadline) break;
					await new Promise((resolve) => setTimeout(resolve, INVITE_LOCK_POLL_MS));
				}
			} else {
				const rows = (await runner.query('SELECT GET_LOCK(?, ?) AS locked', [lockName, INVITE_LOCK_WAIT_MS / 1000])) as Array<{ locked: number | string | null }>;
				locked = Number(rows?.[0]?.locked) === 1;
			}
			if (!locked) throw new ConflictException('Another request is inviting this e-mail; try again.');
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

	/**
	 * A page of the connection's deferred Ever Works inbox events of the mapped organization, newest first (the tab
	 * reads the first; waking a pairing reads them all — waking changes `availableAt` only, so the pages stay put).
	 */
	private deferredInboxEvents(context: EverWorksMappingContext, skip = 0): Promise<EverWorksInboundEvent[]> {
		return this.dataSource.getRepository(EverWorksInboundEvent).find({
			where: {
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				connectionId: context.connection.id as ID,
				aggregateType: EVER_WORKS_INBOX_AGGREGATE,
				status: EverWorksInboundStatus.DEFERRED
			} as never,
			select: { id: true, aggregateId: true, payload: true, seq: true } as never,
			order: { seq: 'DESC', id: 'DESC' } as never,
			skip,
			take: DEFERRED_INBOX_SCAN
		});
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
		const sourceByUser = new Map(links.map((l) => [l.ewId, matchedByOf(l)]));
		const linkedEmployees = new Set(links.map((l) => l.gauzyId));
		const people = await this.people$(context);
		// The Ever ID suggestions: what the automatic pairing left (an admin declined it); a match comes first.
		const unpairedWithEverId = members.filter((m) => !linkByUser.has(m.userId) && m.everIdSubjects?.length);
		const everId = unpairedWithEverId.length ? await this.everIdMatchesOf(context, unpairedWithEverId, linkedEmployees as Set<ID>) : new Map<string, ID>();
		const byEmail = new Map<string, ID>();
		for (const [id, person] of people) if (person.email) byEmail.set(person.email.toLowerCase(), id);
		const invites = await this.pendingInvites(
			context,
			members.filter((m) => !linkByUser.has(m.userId)).map((m) => m.email)
		);
		const rows: EverWorksPersonRow[] = members.map((m) => {
			const linkedEmployeeId = linkByUser.get(m.userId) ?? null;
			const match = !linkedEmployeeId && m.emailVerified && m.email ? byEmail.get(m.email.toLowerCase()) : undefined;
			const everIdMatch = linkedEmployeeId ? undefined : everId.get(m.userId);
			const invite = !linkedEmployeeId && m.email ? invites.get(m.email.toLowerCase()) : undefined;
			return {
				ewUserId: m.userId,
				username: m.username,
				displayName: m.displayName ?? null,
				email: m.email,
				emailVerified: !!m.emailVerified,
				role: m.role,
				isActive: m.isActive !== false,
				linkedEmployeeId,
				matchedBy: linkedEmployeeId ? (sourceByUser.get(m.userId) ?? 'manual') : null,
				suggestion: everIdMatch
					? { employeeId: everIdMatch, reason: 'ever_id' }
					: match && !linkedEmployees.has(match)
						? { employeeId: match, reason: 'verified_email' }
						: null,
				gauzyInvite: invite ? { inviteId: invite.id as ID, expireDate: invite.expireDate ?? null } : null
			};
		});
		return {
			members: rows,
			// A suggestion is not a pairing: a suggested person stays unmatched until the admin confirms it.
			unmatchedEmployees: [...people.entries()]
				.filter(([id]) => !linkedEmployees.has(id))
				.map(([employeeId, p]) => ({ employeeId, name: p.name, email: p.email })),
			deferredInbox: deferredInboxOf(await this.deferredInboxEvents(context), new Set(linkByUser.keys()))
		};
	}

	/** The active people (not agents) of the organization, optionally only the given ones. */
	private async people$(context: EverWorksMappingContext, only?: ID[]): Promise<Map<ID, { name: string; email: string | null; userId: string | null }>> {
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
		const result = new Map<ID, { name: string; email: string | null; userId: string | null }>();
		for (const row of rows) {
			if ((row as Employee & { kind?: string }).kind === EmployeeKindEnum.AGENT) continue;
			const user = row.user;
			const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || (row.id as string);
			result.set(row.id as ID, { name, email: user?.email ?? null, userId: (row.userId as string | undefined) ?? user?.id ?? null });
		}
		return result;
	}
}

/** How a stored People-tab pairing was made (`ewOnly.matchedBy`); a pairing from before it was recorded is `manual`. */
function matchedByOf(link: Pick<EverWorksEntityLink, 'ewOnly'>): EverWorksMatchSource {
	try {
		const value = link.ewOnly ? (JSON.parse(link.ewOnly) as { matchedBy?: unknown }).matchedBy : undefined;
		return value === 'ever_id' || value === 'verified_email' ? value : 'manual';
	} catch {
		return 'manual';
	}
}
