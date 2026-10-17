import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException
} from '@nestjs/common';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import { promisify } from 'node:util';
import { isUUID } from 'class-validator';
import { DataSource, In, IsNull } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	EmployeeKindEnum,
	ID,
	IInboundAddressNamespace,
	IInboxMailbox,
	IInboxMailboxCreateInput,
	IInboxMailboxDomainVerification,
	IInboxMailboxMember,
	IInboxMailboxMemberInput,
	IInboxMailboxProvisionInput,
	IInboxMailboxProvisionResult,
	IInboxMailboxSecret,
	IInboxMailboxUpdateInput,
	IInboxOrganizationEmailSettings,
	InboxMailboxDomainStatusEnum,
	InboxMailboxKindEnum,
	InboxMailboxMemberRoleEnum,
	InboxMailboxOwnerTypeEnum,
	InboxMailboxPurposeEnum,
	InboxProviderAccountScopeEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { InboxNamedLocks } from '../database/named-locks';
import { InboxMailbox } from '../entities/inbox-mailbox.entity';
import { InboxMailboxMember } from '../entities/inbox-mailbox-member.entity';
import { InboxOrganizationSetting } from '../entities/inbox-organization-setting.entity';
import { getInboxEmailConfig } from '../inbound/inbox-email.config';
import { InboxEmailScopeService } from '../inbox-email-scope.service';
import { InboxProviderAccountService } from '../provider-accounts/inbox-provider-account.service';
import { EmailProviderRegistry } from '../providers/email-provider.registry';
import { normalizeAddress } from './address';
import { InboxMailboxAccessService } from './inbox-mailbox-access.service';
import {
	chosenLocalPart,
	employeeName,
	isWithinDomain,
	normalizeDomain,
	platformLocalPart,
	slugSegment
} from './mailbox-address';

const scrypt = promisify(scryptCallback) as (password: string, salt: string, keylen: number) => Promise<Buffer>;

/** The TXT record name a custom domain is proven with: `_gauzy-inbox.<domain>`. */
export const INBOX_DOMAIN_TXT_PREFIX = '_gauzy-inbox';
const DNS_TIMEOUT_MS = 5_000;
const MAX_ALLOWLIST = 200;
const MAX_MEMBERS = 500;
const MAX_ALLOCATION_ATTEMPTS = 50;

const parse = <T>(value: string | null | undefined, fallback: T): T => {
	if (!value) return fallback;
	try {
		return (JSON.parse(value) as T) ?? fallback;
	} catch {
		return fallback;
	}
};

/** Whether a query failed because its table does not exist (PostgreSQL 42P01, MySQL 1146, SQLite). */
export function isMissingTable(error: unknown): boolean {
	const code = String(
		(error as { code?: unknown })?.code ?? (error as { driverError?: { code?: unknown } })?.driverError?.code ?? ''
	);
	const message = String((error as Error)?.message ?? '');
	return (
		code === '42P01' ||
		code === 'ER_NO_SUCH_TABLE' ||
		/no such table|relation .* does not exist|table .* doesn't exist/i.test(message)
	);
}

/** An owner's names, as the address is allocated from them. */
interface OwnerNames {
	name: string;
	displayName: string;
}

/**
 * Mailbox management (plan 04 §3 `/mailboxes`, §5.1, G-P4-1): the addresses an organization receives mail at.
 *
 * - **Platform addresses** are allocated on `GAUZY_INBOX_DOMAIN`, the organization encoded in the local part —
 *   `<first>.<last>.<orgSlug>` for an employee, `<name>.<orgSlug>` for the organization (several), `<team>.<orgSlug>`
 *   for a team — with a numeric suffix on a collision. They receive through the platform route.
 * - **Custom domains**: any `x@acme.com` once the organization proves the domain with a DNS TXT record at
 *   `_gauzy-inbox.<domain>` — each mailbox with its own value (several TXT values can sit at that name), and each
 *   check changes only that mailbox; they receive through a provider account of the organization (or the tenant).
 * - **Forwarding**: a platform address the user forwards an existing mailbox to (no DNS change).
 * - **Auto-provisioning** (opt-in per organization): a mailbox for every employee, now and on each new employee (never
 *   for agent employees), and a default organization mailbox (`inbox.<orgSlug>`). The check for a missing mailbox and
 *   its creation run under the organization's lock, so overlapping runs never create one twice.
 * - **Members** of organization and team mailboxes (READER or MANAGER).
 *
 * One address namespace: an address is unique across all mailboxes of the deployment and is also checked against the
 * Docs plugin's capture addresses, both features checking and saving under the address's claim. Management needs `INBOX_MAILBOX_MANAGE` and a membership of the organization (the
 * routes check the permission, this service the membership); the tenant is always the caller's.
 */
@Injectable()
export class InboxMailboxService implements IInboundAddressNamespace {
	private readonly logger = new Logger(InboxMailboxService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly scope: InboxEmailScopeService,
		private readonly accounts: InboxProviderAccountService,
		private readonly providers: EmailProviderRegistry,
		private readonly access: InboxMailboxAccessService
	) {
		this.locks = new InboxNamedLocks(dataSource);
	}

	private readonly locks: InboxNamedLocks;

	// ---------------------------------------------------------------- reads

	async list(organizationId?: ID): Promise<IInboxMailbox[]> {
		const { tenantId, organizationId: orgId } = await this.scope.resolve(organizationId);
		const rows = await this.dataSource.getRepository(InboxMailbox).find({
			where: { tenantId, organizationId: orgId, deletedAt: IsNull() },
			order: { createdAt: 'ASC' }
		});
		return rows.map((row) => this.toMailbox(row));
	}

	/**
	 * The caller's own mailboxes: the ones whose mail they receive, by the delivery rules (`InboxMailboxAccessService`)
	 * — their employee mailboxes, the shared ones they are a member of, and the team and organization mailboxes without
	 * members that fall back to them (the team's members; the organization's users who may manage mailboxes).
	 */
	async mine(): Promise<Array<IInboxMailbox & { forwardingInstructions?: string }>> {
		const tenantId = RequestContext.currentTenantId();
		const userId = RequestContext.currentUserId();
		if (!tenantId || !userId) throw new ForbiddenException('The inbox needs a signed-in user of a tenant.');
		const employees = (
			await this.dataSource
				.createQueryBuilder()
				.select('e.id', 'id')
				.from('employee', 'e')
				.where('e.tenantId = :tenantId', { tenantId })
				.andWhere('e.userId = :userId', { userId })
				.getRawMany<{ id: ID }>()
		).map((row) => row.id);
		const memberOf = (
			await this.dataSource
				.getRepository(InboxMailboxMember)
				.find({ where: { tenantId, userId, deletedAt: IsNull() } })
		).map((row) => row.mailboxId);
		const teams = (
			await this.dataSource
				.createQueryBuilder()
				.select('m.organizationTeamId', 'teamId')
				.from('organization_team_employee', 'm')
				.innerJoin('employee', 'e', 'e.id = m.employeeId')
				.where('m.tenantId = :tenantId', { tenantId })
				.andWhere('e.userId = :userId', { userId })
				.andWhere('m.deletedAt IS NULL')
				.getRawMany<{ teamId: ID }>()
		).map((row) => row.teamId);
		const managedOrganizations = RequestContext.hasPermission(PermissionsEnum.INBOX_MAILBOX_MANAGE)
			? (
					await this.dataSource
						.createQueryBuilder()
						.select('uo.organizationId', 'organizationId')
						.from('user_organization', 'uo')
						.where('uo.tenantId = :tenantId', { tenantId })
						.andWhere('uo.userId = :userId', { userId })
						.andWhere('uo.isActive = :active', { active: true })
						.getRawMany<{ organizationId: ID }>()
				).map((row) => row.organizationId)
			: [];
		const repository = this.dataSource.getRepository(InboxMailbox);
		const rows = [
			...(employees.length
				? await repository.find({ where: { tenantId, ownerEmployeeId: In(employees), deletedAt: IsNull() } })
				: []),
			...(memberOf.length
				? await repository.find({ where: { tenantId, id: In(memberOf), deletedAt: IsNull() } })
				: []),
			...(teams.length
				? await repository.find({
						where: {
							tenantId,
							ownerType: InboxMailboxOwnerTypeEnum.TEAM,
							ownerTeamId: In(teams),
							deletedAt: IsNull()
						}
					})
				: []),
			...(managedOrganizations.length
				? await repository.find({
						where: {
							tenantId,
							ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
							organizationId: In(managedOrganizations),
							deletedAt: IsNull()
						}
					})
				: [])
		];
		const seen = new Set<ID>();
		const candidates = rows.filter((row) => (seen.has(row.id as ID) ? false : (seen.add(row.id as ID), true)));
		// The same rules the mail is delivered by (members first, the fallbacks only without members; users still in
		// the organization).
		const receives = await Promise.all(
			candidates.map(async (row) => (await this.access.recipientsOf(row)).includes(userId as ID))
		);
		return candidates
			.filter((_row, index) => receives[index])
			.map((row) => ({
				...this.toMailbox(row),
				...(row.kind === InboxMailboxKindEnum.FORWARDING || row.kind === InboxMailboxKindEnum.PLATFORM
					? {
							forwardingInstructions: `Forward the mail you want in Gauzy to ${row.address} (in your mail provider's forwarding settings); it then arrives in your Inbox.`
						}
					: {})
			}));
	}

	async get(id: ID, organizationId?: ID): Promise<IInboxMailbox> {
		return this.toMailbox(await this.managed(id, organizationId));
	}

	// ---------------------------------------------------------------- writes

	async create(
		input: IInboxMailboxCreateInput
	): Promise<IInboxMailbox & { verification?: IInboxMailboxDomainVerification }> {
		const { tenantId, organizationId } = await this.scope.resolve(input?.organizationId);
		const kind = input?.kind ?? InboxMailboxKindEnum.PLATFORM;
		if (
			![
				InboxMailboxKindEnum.PLATFORM,
				InboxMailboxKindEnum.CUSTOM_DOMAIN,
				InboxMailboxKindEnum.FORWARDING
			].includes(kind)
		) {
			throw new BadRequestException('A mailbox is PLATFORM, CUSTOM_DOMAIN or FORWARDING.');
		}
		const owner = await this.owner(tenantId, organizationId, input);
		const providerAccountId = await this.receivingAccount(
			tenantId,
			organizationId,
			kind,
			input?.providerAccountId ?? null
		);
		const senderAllowlist = this.allowlist(input?.senderAllowlist);

		let address: string;
		let domain: string | null = null;
		if (kind === InboxMailboxKindEnum.CUSTOM_DOMAIN) {
			domain = normalizeDomain(input?.domain);
			const localPart = chosenLocalPart(input?.localPart);
			if (!domain || !localPart)
				throw new BadRequestException('A custom-domain mailbox needs a domain and a local part.');
			const reserved = getInboxEmailConfig().domain;
			if (isWithinDomain(domain, reserved) || isWithinDomain(domain, process.env['GAUZY_DOCS_INBOUND_DOMAIN'])) {
				throw new BadRequestException('That domain is reserved by the platform.');
			}
			address = `${localPart}@${domain}`;
			if (await this.isTaken(address)) throw new ConflictException('That address is already taken.');
		} else {
			address = await this.allocate(organizationId, input?.localPart ?? null, owner);
		}

		const repository = this.dataSource.getRepository(InboxMailbox);
		// The last check and the save under the address's claim (shared with the Docs capture addresses).
		const row = await this.claim(address, async () => {
			if (await this.isTaken(address)) throw new ConflictException('That address is already taken.');
			try {
				return await repository.save(
					repository.create({
						tenantId,
						organizationId,
						address,
						displayName: (input?.displayName?.trim() || owner.displayName || null)?.slice(0, 200) ?? null,
						kind,
						ownerType: input.ownerType,
						...(input.ownerType === InboxMailboxOwnerTypeEnum.EMPLOYEE
							? { ownerEmployeeId: input.ownerEmployeeId }
							: {}),
						...(input.ownerType === InboxMailboxOwnerTypeEnum.TEAM
							? { ownerTeamId: input.ownerTeamId }
							: {}),
						purpose: InboxMailboxPurposeEnum.INBOX,
						...(providerAccountId ? { providerAccountId } : {}),
						senderAllowlist: senderAllowlist.length ? JSON.stringify(senderAllowlist) : null,
						domain,
						domainStatus: domain ? InboxMailboxDomainStatusEnum.PENDING : null,
						domainVerificationToken: domain
							? `gauzy-inbox-verify=${randomBytes(16).toString('hex')}`
							: null,
						isDefault: false,
						autoProvisioned: false,
						messageCount: 0,
						settings:
							kind === InboxMailboxKindEnum.FORWARDING && normalizeAddress(input?.forwardFrom)
								? JSON.stringify({ forwardFrom: normalizeAddress(input?.forwardFrom)?.address })
								: null
					} as InboxMailbox)
				);
			} catch (error) {
				// The unique address index: another request took it between the check and the insert.
				if (await this.isTaken(address)) throw new ConflictException('That address is already taken.');
				throw error;
			}
		});
		if (input?.isDefault) await this.makeDefault(row);
		const stored = (await repository.findOne({ where: { id: row.id as ID } })) as InboxMailbox;
		return {
			...this.toMailbox(stored),
			...(domain ? { verification: this.verificationOf(stored) } : {})
		};
	}

	async update(id: ID, input: IInboxMailboxUpdateInput, organizationId?: ID): Promise<IInboxMailbox> {
		const row = await this.managed(id, organizationId);
		const change: QueryDeepPartialEntity<InboxMailbox> = {};
		if (input?.displayName !== undefined) change.displayName = input.displayName?.trim().slice(0, 200) || null;
		if (typeof input?.isActive === 'boolean') change.isActive = input.isActive;
		if (input?.senderAllowlist !== undefined) {
			const list = this.allowlist(input.senderAllowlist);
			change.senderAllowlist = list.length ? JSON.stringify(list) : null;
		}
		if (input?.providerAccountId !== undefined) {
			const accountId = await this.receivingAccount(
				row.tenantId as ID,
				row.organizationId as ID,
				row.kind,
				input.providerAccountId
			);
			change.providerAccountId = (accountId ?? null) as never;
		}
		if (input?.settings !== undefined) {
			if (input.settings !== null && (typeof input.settings !== 'object' || Array.isArray(input.settings))) {
				throw new BadRequestException('settings must be an object.');
			}
			const text = input.settings === null ? null : JSON.stringify(input.settings);
			if (text && text.length > 10_000) throw new BadRequestException('settings are at most 10000 characters.');
			change.settings = text;
		}
		if (Object.keys(change).length > 0) {
			await this.dataSource.getRepository(InboxMailbox).update({ id: row.id as ID }, change);
		}
		if (input?.isDefault === true) await this.makeDefault(row);
		if (input?.isDefault === false) {
			await this.dataSource.getRepository(InboxMailbox).update({ id: row.id as ID }, { isDefault: false });
		}
		return this.get(id, organizationId);
	}

	/** Looks up `_gauzy-inbox.<domain>` IN TXT: the expected value verifies; a verified domain whose record is gone fails. */
	async verify(id: ID, organizationId?: ID): Promise<IInboxMailboxDomainVerification> {
		const row = await this.managed(id, organizationId);
		if (row.kind !== InboxMailboxKindEnum.CUSTOM_DOMAIN || !row.domain) {
			throw new BadRequestException('Only a custom-domain mailbox is verified.');
		}
		let observed: string[] = [];
		let message: string | undefined;
		try {
			observed = (await this.resolveTxt(`${INBOX_DOMAIN_TXT_PREFIX}.${row.domain}`)).map((value) => value.trim());
		} catch (error) {
			message = (error as Error)?.message ?? 'The DNS lookup failed.';
		}
		const matched = !!row.domainVerificationToken && observed.includes(row.domainVerificationToken);
		const status = matched
			? InboxMailboxDomainStatusEnum.VERIFIED
			: row.domainStatus === InboxMailboxDomainStatusEnum.VERIFIED
				? InboxMailboxDomainStatusEnum.FAILED
				: InboxMailboxDomainStatusEnum.PENDING;
		// Only this mailbox follows the check: each mailbox has its own token, so another mailbox on the domain keeps
		// the status its own record earned.
		await this.dataSource.getRepository(InboxMailbox).update({ id: row.id as ID }, { domainStatus: status });
		const stored = (await this.dataSource
			.getRepository(InboxMailbox)
			.findOne({ where: { id: row.id as ID } })) as InboxMailbox;
		return {
			...this.verificationOf(stored),
			...(matched ? {} : { message: message ?? 'The expected TXT record was not found.' })
		};
	}

	/**
	 * The DNS record that proves a custom-domain mailbox, and its last known status, without a new DNS lookup (the
	 * Settings page shows it for a domain still to be set up; `verify` checks it).
	 */
	async verification(id: ID, organizationId?: ID): Promise<IInboxMailboxDomainVerification> {
		const row = await this.managed(id, organizationId);
		if (row.kind !== InboxMailboxKindEnum.CUSTOM_DOMAIN || !row.domain) {
			throw new BadRequestException('Only a custom-domain mailbox has a DNS record to create.');
		}
		return this.verificationOf(row);
	}

	/** A new relay secret (stored as a scrypt digest), answered this once. */
	async rotateSecret(id: ID, organizationId?: ID): Promise<IInboxMailboxSecret> {
		const row = await this.managed(id, organizationId);
		const secret = randomBytes(32).toString('base64url');
		const salt = randomBytes(16).toString('hex');
		const digest = (await scrypt(secret, salt, 32)).toString('hex');
		await this.dataSource
			.getRepository(InboxMailbox)
			.update({ id: row.id as ID }, { inboundSecretHash: `scrypt:${salt}:${digest}` });
		return { address: row.address, inboundSecret: secret };
	}

	async members(id: ID, organizationId?: ID): Promise<IInboxMailboxMember[]> {
		const row = await this.managed(id, organizationId);
		return (
			await this.dataSource
				.getRepository(InboxMailboxMember)
				.find({ where: { mailboxId: row.id as ID, deletedAt: IsNull() }, order: { createdAt: 'ASC' } })
		).map((member) => ({ userId: member.userId, role: member.role }));
	}

	/** Replaces the members of an organization or team mailbox (users of the organization only). */
	async setMembers(id: ID, input: IInboxMailboxMemberInput[], organizationId?: ID): Promise<IInboxMailboxMember[]> {
		const row = await this.managed(id, organizationId);
		if (row.ownerType === InboxMailboxOwnerTypeEnum.EMPLOYEE) {
			throw new BadRequestException('An employee mailbox has no members: it is its employee’s.');
		}
		if (!Array.isArray(input) || input.length > MAX_MEMBERS) {
			throw new BadRequestException(`A mailbox has at most ${MAX_MEMBERS} members.`);
		}
		const wanted = new Map<ID, InboxMailboxMemberRoleEnum>();
		for (const member of input) {
			if (!member?.userId || !isUUID(member.userId)) throw new BadRequestException('A member needs a user id.');
			const role = member.role ?? InboxMailboxMemberRoleEnum.READER;
			if (!Object.values(InboxMailboxMemberRoleEnum).includes(role))
				throw new BadRequestException('A role is READER or MANAGER.');
			wanted.set(member.userId, role);
		}
		const ids = [...wanted.keys()];
		const allowed = new Set(
			ids.length === 0
				? []
				: (
						await this.dataSource
							.createQueryBuilder()
							.select('uo.userId', 'userId')
							.from('user_organization', 'uo')
							.where('uo.tenantId = :tenantId', { tenantId: row.tenantId })
							.andWhere('uo.organizationId = :organizationId', { organizationId: row.organizationId })
							.andWhere('uo.userId IN (:...ids)', { ids })
							.andWhere('uo.isActive = :active', { active: true })
							.getRawMany<{ userId: ID }>()
					).map((entry) => entry.userId)
		);
		const outside = ids.filter((userId) => !allowed.has(userId));
		if (outside.length > 0) throw new BadRequestException('Every member must be a user of the organization.');

		await this.dataSource.transaction(async (manager) => {
			const repository = manager.getRepository(InboxMailboxMember);
			await repository.delete({ mailboxId: row.id as ID });
			for (const [userId, role] of wanted) {
				await repository.save(
					repository.create({
						tenantId: row.tenantId,
						organizationId: row.organizationId,
						mailboxId: row.id as ID,
						userId,
						role
					} as InboxMailboxMember)
				);
			}
		});
		return this.members(id, organizationId);
	}

	/** Creates what is missing now: employee mailboxes, the default organization mailbox. */
	async provision(input: IInboxMailboxProvisionInput): Promise<IInboxMailboxProvisionResult> {
		const { tenantId, organizationId } = await this.scope.resolve(input?.organizationId);
		const created: IInboxMailbox[] = [];
		let existing = 0;
		if (input?.employees) {
			for (const employeeId of await this.employeesWithoutMailbox(tenantId, organizationId)) {
				const mailbox = await this.provisionEmployee(tenantId, organizationId, employeeId);
				if (mailbox) created.push(mailbox);
				else existing += 1;
			}
		}
		if (input?.defaultOrganizationMailbox) {
			const mailbox = await this.provisioning(organizationId, async () => {
				const has = await this.dataSource.getRepository(InboxMailbox).findOne({
					where: {
						tenantId,
						organizationId,
						ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
						isDefault: true,
						deletedAt: IsNull()
					}
				});
				if (has) return null;
				return this.createSystem(tenantId, organizationId, {
					ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
					localPart: 'inbox',
					isDefault: true
				});
			});
			if (mailbox) created.push(mailbox);
			else existing += 1;
		}
		return { created, existing };
	}

	async settings(organizationId?: ID): Promise<IInboxOrganizationEmailSettings> {
		const { tenantId, organizationId: orgId } = await this.scope.resolve(organizationId);
		const row = await this.dataSource
			.getRepository(InboxOrganizationSetting)
			.findOne({ where: { tenantId, organizationId: orgId } });
		return {
			organizationId: orgId,
			autoProvisionEmployees: !!row?.autoProvisionEmployees,
			platformDomain: getInboxEmailConfig().domain
		};
	}

	async updateSettings(
		input: { autoProvisionEmployees?: boolean },
		organizationId?: ID
	): Promise<IInboxOrganizationEmailSettings> {
		const { tenantId, organizationId: orgId } = await this.scope.resolve(organizationId);
		const repository = this.dataSource.getRepository(InboxOrganizationSetting);
		const row = await repository.findOne({ where: { tenantId, organizationId: orgId } });
		const value = !!input?.autoProvisionEmployees;
		if (row) await repository.update({ id: row.id as ID }, { autoProvisionEmployees: value });
		else {
			try {
				await repository.save(
					repository.create({
						tenantId,
						organizationId: orgId,
						autoProvisionEmployees: value
					} as InboxOrganizationSetting)
				);
			} catch {
				// Saved by an overlapping request (one row per organization): apply the value to it.
				await repository.update({ tenantId, organizationId: orgId }, { autoProvisionEmployees: value });
			}
		}
		return this.settings(orgId);
	}

	/**
	 * A new employee's mailbox, when the organization opted in (`autoProvisionEmployees`). Called for every employee
	 * the platform creates; never for agent employees. Best effort: a failure is logged, never thrown.
	 */
	async onEmployeeCreated(employee: {
		id?: ID;
		tenantId?: ID | null;
		organizationId?: ID | null;
		kind?: string | null;
	}): Promise<void> {
		try {
			if (!employee?.id || !employee.tenantId || !employee.organizationId) return;
			if (employee.kind === EmployeeKindEnum.AGENT) return;
			const setting = await this.dataSource.getRepository(InboxOrganizationSetting).findOne({
				where: { tenantId: employee.tenantId, organizationId: employee.organizationId }
			});
			if (!setting?.autoProvisionEmployees || !getInboxEmailConfig().domain) return;
			await this.provisionEmployee(employee.tenantId, employee.organizationId, employee.id);
		} catch (error) {
			this.logger.warn(
				`The mailbox of employee ${employee?.id} was not provisioned: ${(error as Error)?.message}`
			);
		}
	}

	// ---------------------------------------------------------------- the address namespace

	/** Whether a domain is the platform mailbox domain (`GAUZY_INBOX_DOMAIN`) or under it (the Docs hook asks). */
	isReservedDomain(domain: string): boolean {
		return isWithinDomain(normalizeDomain(domain) ?? domain.trim().toLowerCase(), getInboxEmailConfig().domain);
	}

	/** Runs `work` (an address's check and save) while no other claim of the address runs, in either feature. */
	claim<T>(address: string, work: () => Promise<T>): Promise<T> {
		const normalized = normalizeAddress(address)?.address ?? address.trim().toLowerCase();
		return this.locks.run(`address:${normalized}`, work);
	}

	/** Whether an address is taken by a mailbox or a Docs capture address (one namespace, plan 04 §5.1). */
	async isTaken(address: string): Promise<boolean> {
		const normalized = normalizeAddress(address)?.address ?? address.trim().toLowerCase();
		const mailbox = await this.dataSource.getRepository(InboxMailbox).findOne({ where: { address: normalized } });
		if (mailbox) return true;
		try {
			const rows = await this.dataSource
				.createQueryBuilder()
				.select('d.id', 'id')
				.from('document_inbound_address', 'd')
				.where('LOWER(d.address) = :address', { address: normalized })
				.limit(1)
				.getRawMany();
			return rows.length > 0;
		} catch (error) {
			// The Docs plugin is not installed here (no such table): nothing more to check. Any other failure is not an
			// answer: the address could be taken, so the caller fails rather than allocating it.
			if (isMissingTable(error)) return false;
			throw error;
		}
	}

	// ---------------------------------------------------------------- helpers

	/** A mailbox of the caller's tenant and organization (404 otherwise, so ids are not probed). */
	private async managed(id: ID, organizationId?: ID): Promise<InboxMailbox> {
		const { tenantId, organizationId: orgId } = await this.scope.resolve(organizationId);
		const row = isUUID(id)
			? await this.dataSource
					.getRepository(InboxMailbox)
					.findOne({ where: { id, tenantId, organizationId: orgId } })
			: null;
		if (!row || row.deletedAt) throw new NotFoundException('The mailbox does not exist.');
		return row;
	}

	/** The owner of a new mailbox (checked against the organization) and the names its address comes from. */
	private async owner(tenantId: ID, organizationId: ID, input: IInboxMailboxCreateInput): Promise<OwnerNames> {
		switch (input?.ownerType) {
			case InboxMailboxOwnerTypeEnum.EMPLOYEE: {
				const employee =
					input.ownerEmployeeId && isUUID(input.ownerEmployeeId)
						? await this.dataSource
								.createQueryBuilder()
								.select('e.id', 'id')
								.addSelect('e.kind', 'kind')
								.addSelect('u.firstName', 'firstName')
								.addSelect('u.lastName', 'lastName')
								.addSelect('u.email', 'email')
								.from('employee', 'e')
								.leftJoin('user', 'u', 'u.id = e.userId')
								.where('e.id = :id', { id: input.ownerEmployeeId })
								.andWhere('e.tenantId = :tenantId', { tenantId })
								.andWhere('e.organizationId = :organizationId', { organizationId })
								.getRawOne<{
									id: ID;
									kind?: string;
									firstName?: string;
									lastName?: string;
									email?: string;
								}>()
						: null;
				if (!employee) throw new BadRequestException('The employee is not one of the organization’s.');
				const name = employeeName(employee.firstName, employee.lastName, employee.email);
				return { name, displayName: [employee.firstName, employee.lastName].filter(Boolean).join(' ') };
			}
			case InboxMailboxOwnerTypeEnum.TEAM: {
				const team =
					input.ownerTeamId && isUUID(input.ownerTeamId)
						? await this.dataSource
								.createQueryBuilder()
								.select('t.id', 'id')
								.addSelect('t.name', 'name')
								.from('organization_team', 't')
								.where('t.id = :id', { id: input.ownerTeamId })
								.andWhere('t.tenantId = :tenantId', { tenantId })
								.andWhere('t.organizationId = :organizationId', { organizationId })
								.getRawOne<{ id: ID; name?: string }>()
						: null;
				if (!team) throw new BadRequestException('The team is not one of the organization’s.');
				return { name: slugSegment(team.name) || 'team', displayName: team.name ?? '' };
			}
			case InboxMailboxOwnerTypeEnum.ORGANIZATION:
				return { name: 'inbox', displayName: '' };
			default:
				throw new BadRequestException('A mailbox is owned by an EMPLOYEE, the ORGANIZATION or a TEAM.');
		}
	}

	/** A free platform address for the owner on `GAUZY_INBOX_DOMAIN` (a chosen name part, else the owner's names). */
	private async allocate(organizationId: ID, chosen: string | null, owner: OwnerNames): Promise<string> {
		const domain = getInboxEmailConfig().domain;
		if (!domain)
			throw new BadRequestException('GAUZY_INBOX_DOMAIN is not set: this server has no platform mailbox domain.');
		const name = chosen === null || chosen === undefined || chosen === '' ? owner.name : chosenLocalPart(chosen);
		if (!name) throw new BadRequestException('The name of the address is letters, digits, dashes and dots.');
		const orgSlug = await this.organizationSlug(organizationId);
		for (let attempt = 1; attempt <= MAX_ALLOCATION_ATTEMPTS; attempt++) {
			const local = platformLocalPart(name, orgSlug, attempt);
			if (!local) break;
			const address = `${local}@${domain}`;
			if (!(await this.isTaken(address))) return address;
			// A chosen name is the caller's: tell them it is taken rather than numbering it.
			if (chosen) throw new ConflictException('That address is already taken.');
		}
		throw new ConflictException('No free address could be allocated for this mailbox.');
	}

	private async organizationSlug(organizationId: ID): Promise<string> {
		const row = await this.dataSource
			.createQueryBuilder()
			.select('o.name', 'name')
			.addSelect('o.profile_link', 'profileLink')
			.from('organization', 'o')
			.where('o.id = :id', { id: organizationId })
			.getRawOne<{ name?: string; profileLink?: string }>();
		return slugSegment(row?.profileLink) || slugSegment(row?.name) || 'org';
	}

	/** The provider account a mailbox receives through: none for platform addresses, an inbound account for a domain. */
	private async receivingAccount(
		tenantId: ID,
		organizationId: ID,
		kind: InboxMailboxKindEnum,
		accountId: ID | null
	): Promise<ID | null> {
		if (kind !== InboxMailboxKindEnum.CUSTOM_DOMAIN) {
			if (accountId)
				throw new BadRequestException(
					'A platform address receives through the platform route, not an account.'
				);
			return null;
		}
		if (!accountId)
			throw new BadRequestException('A custom-domain mailbox receives through a provider account: name one.');
		const account = await this.accounts.findUsable(accountId, tenantId);
		const fits =
			!!account &&
			(account.scope === InboxProviderAccountScopeEnum.TENANT || account.organizationId === organizationId) &&
			!!this.providers.get(account.providerId)?.capabilities.inbound;
		if (!fits) throw new BadRequestException('The provider account does not receive mail for this organization.');
		return accountId;
	}

	private allowlist(value: unknown): string[] {
		if (value === undefined || value === null) return [];
		if (!Array.isArray(value) || value.length > MAX_ALLOWLIST) {
			throw new BadRequestException(`The sender allowlist is a list of at most ${MAX_ALLOWLIST} entries.`);
		}
		return [
			...new Set(
				value.map((entry) => {
					const text = typeof entry === 'string' ? entry.trim().toLowerCase() : '';
					const ok = text.startsWith('@') ? !!normalizeDomain(text.slice(1)) : !!normalizeAddress(text);
					if (!ok)
						throw new BadRequestException(
							`${String(entry).slice(0, 80)} is neither an address nor an @domain.`
						);
					return text;
				})
			)
		];
	}

	/** Makes `row` its owner's (the organization's, this team's, this employee's) only default mailbox. */
	private async makeDefault(row: InboxMailbox): Promise<void> {
		const repository = this.dataSource.getRepository(InboxMailbox);
		await repository.update(
			{
				tenantId: row.tenantId as ID,
				organizationId: row.organizationId as ID,
				ownerType: row.ownerType,
				...(row.ownerType === InboxMailboxOwnerTypeEnum.TEAM ? { ownerTeamId: row.ownerTeamId as ID } : {}),
				...(row.ownerType === InboxMailboxOwnerTypeEnum.EMPLOYEE
					? { ownerEmployeeId: row.ownerEmployeeId as ID }
					: {}),
				isDefault: true
			},
			{ isDefault: false }
		);
		await repository.update({ id: row.id as ID }, { isDefault: true });
	}

	private async employeesWithoutMailbox(tenantId: ID, organizationId: ID): Promise<ID[]> {
		const employees = await this.dataSource
			.createQueryBuilder()
			.select('e.id', 'id')
			.addSelect('e.kind', 'kind')
			.from('employee', 'e')
			.where('e.tenantId = :tenantId', { tenantId })
			.andWhere('e.organizationId = :organizationId', { organizationId })
			.andWhere('e.isActive = :active', { active: true })
			.andWhere('e.deletedAt IS NULL')
			.getRawMany<{ id: ID; kind?: string }>();
		const humans = employees.filter((row) => row.kind !== EmployeeKindEnum.AGENT).map((row) => row.id);
		if (humans.length === 0) return [];
		const owned = new Set(
			(
				await this.dataSource
					.getRepository(InboxMailbox)
					.find({ where: { tenantId, ownerEmployeeId: In(humans), deletedAt: IsNull() } })
			).map((row) => row.ownerEmployeeId)
		);
		return humans.filter((id) => !owned.has(id));
	}

	/** The employee's platform mailbox, created when it has none (answers `null` when it had one). */
	private provisionEmployee(tenantId: ID, organizationId: ID, employeeId: ID): Promise<IInboxMailbox | null> {
		return this.provisioning(organizationId, async () => {
			const has = await this.dataSource
				.getRepository(InboxMailbox)
				.findOne({ where: { tenantId, ownerEmployeeId: employeeId, deletedAt: IsNull() } });
			if (has) return null;
			return this.createSystem(tenantId, organizationId, {
				ownerType: InboxMailboxOwnerTypeEnum.EMPLOYEE,
				ownerEmployeeId: employeeId
			});
		});
	}

	/**
	 * Runs a provisioning step (the check for a missing mailbox and its creation) under the organization's lock: an
	 * overlapping run (the employee-created hook, a manual provisioning, another replica) waits, then finds the mailbox.
	 */
	private provisioning<T>(organizationId: ID, work: () => Promise<T>): Promise<T> {
		return this.locks.run(`provision:${organizationId}`, work);
	}

	/** A platform mailbox the system creates (provisioning), outside a request's organization membership check. */
	private async createSystem(
		tenantId: ID,
		organizationId: ID,
		input: Pick<IInboxMailboxCreateInput, 'ownerType' | 'ownerEmployeeId' | 'localPart' | 'isDefault'>
	): Promise<IInboxMailbox | null> {
		const owner = await this.owner(tenantId, organizationId, input as IInboxMailboxCreateInput);
		const repository = this.dataSource.getRepository(InboxMailbox);
		for (let tries = 0; tries < 3; tries++) {
			const address = await this.allocate(
				organizationId,
				null,
				input.localPart ? { ...owner, name: input.localPart } : owner
			);
			// The last check and the save under the address's claim, as every address is taken.
			const row = await this.claim(address, async () => {
				if (await this.isTaken(address)) return null;
				try {
					return await repository.save(
						repository.create({
							tenantId,
							organizationId,
							address,
							displayName: owner.displayName || null,
							kind: InboxMailboxKindEnum.PLATFORM,
							ownerType: input.ownerType,
							...(input.ownerEmployeeId ? { ownerEmployeeId: input.ownerEmployeeId } : {}),
							purpose: InboxMailboxPurposeEnum.INBOX,
							isDefault: !!input.isDefault,
							autoProvisioned: true,
							messageCount: 0
						} as InboxMailbox)
					);
				} catch (error) {
					// The address was taken in between (outside the claim): allocate again.
					if (!(await this.isTaken(address))) throw error;
					return null;
				}
			});
			if (row) return this.toMailbox(row);
		}
		return null;
	}

	private async resolveTxt(name: string): Promise<string[]> {
		let timer: NodeJS.Timeout | undefined;
		const timeout = new Promise<never>((_, reject) => {
			timer = setTimeout(() => reject(new Error('The DNS lookup timed out.')), DNS_TIMEOUT_MS);
			timer.unref?.();
		});
		try {
			const records = (await Promise.race([resolveTxt(name), timeout])) as string[][];
			return records.map((chunks) => chunks.join(''));
		} finally {
			if (timer) clearTimeout(timer);
		}
	}

	private verificationOf(row: InboxMailbox): IInboxMailboxDomainVerification {
		return {
			recordType: 'TXT',
			recordName: `${INBOX_DOMAIN_TXT_PREFIX}.${row.domain}`,
			recordValue: row.domainVerificationToken ?? '',
			status: (row.domainStatus ?? InboxMailboxDomainStatusEnum.PENDING) as InboxMailboxDomainStatusEnum
		};
	}

	private toMailbox(row: InboxMailbox): IInboxMailbox {
		return {
			id: row.id,
			tenantId: row.tenantId,
			organizationId: row.organizationId,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			isActive: row.isActive,
			address: row.address,
			displayName: row.displayName ?? null,
			kind: row.kind,
			ownerType: row.ownerType,
			ownerEmployeeId: row.ownerEmployeeId ?? null,
			ownerTeamId: row.ownerTeamId ?? null,
			purpose: row.purpose,
			providerAccountId: row.providerAccountId ?? null,
			senderAllowlist: parse<string[]>(row.senderAllowlist, []),
			domain: row.domain ?? null,
			domainStatus: (row.domainStatus as InboxMailboxDomainStatusEnum | null) ?? null,
			isDefault: !!row.isDefault,
			autoProvisioned: !!row.autoProvisioned,
			lastMessageAt: row.lastMessageAt ?? null,
			messageCount: row.messageCount ?? 0,
			settings: parse<Record<string, unknown> | null>(row.settings, null)
		} as IInboxMailbox;
	}
}
