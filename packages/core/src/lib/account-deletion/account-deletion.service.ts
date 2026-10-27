import { GoneException, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, MoreThan, Not } from 'typeorm';
import { pick } from 'underscore';
import { environment } from '@gauzy/config';
import { deepMerge } from '@gauzy/utils';
import {
	AccountDeletionOutcomeEnum,
	IAccountDeletionAccount,
	IAccountDeletionPreview,
	IAccountDeletionRequestInput,
	IAccountDeletionResult,
	ID,
	LanguagesEnum,
	RolesEnum
} from '@gauzy/contracts';
import { allowedEmailLink, warnRejectedEmailLink, withAllowedEmailLinks } from '../auth/email-link-origin';
import { AuthenticatedUserCache } from '../auth/strategies/authenticated-user-cache';
import { Tenant, User, UserOrganization } from '../core/entities/internal';
import { EmailService } from '../email-send/email.service';
import { isDefaultProtectedUser } from '../user/default-protected-users';
import { detachUserAuthorship } from '../user/user-authorship';
import { AccountDeletionRequest } from './account-deletion-request.entity';
import {
	ACCOUNT_DELETION_EMAIL_WINDOW_MS,
	ACCOUNT_DELETION_MAX_REQUESTS_PER_EMAIL,
	accountDeletionTtlMinutes,
	buildAccountDeletionLink,
	generateAccountDeletionToken,
	hashAccountDeletionEmail,
	hashAccountDeletionIp,
	hashAccountDeletionToken,
	isWellFormedAccountDeletionToken,
	maskAccountDeletionEmail,
	normalizeAccountDeletionEmail
} from './account-deletion-token';
import { TypeOrmAccountDeletionRequestRepository } from './repository/type-orm-account-deletion-request.repository';

/** The one answer every bad, used, revoked or expired link gets, so a caller learns nothing from it. */
export const ACCOUNT_DELETION_INVALID_LINK_MESSAGE = 'This link is invalid or has expired. Request a new one.';

/** The integration fields a request may brand the emails with (same set as the sign-in code request). */
const INTEGRATION_FIELDS = ['appName', 'appLogo', 'appSignature', 'appLink', 'companyLink', 'companyName'];

/** Roles that administer a workspace. */
const ADMIN_ROLES: string[] = [RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN];

/** Who sent a request, for the audit record. */
export interface AccountDeletionRequestMeta {
	ip?: string | null;
	userAgent?: string | null;
}

/** One account of the address, with what confirming would do to it. */
interface PlannedAccount {
	user: User;
	account: IAccountDeletionAccount;
}

/**
 * Deleting your account(s) from a link sent to your email address, without signing in.
 *
 * 1. `request(email)`: when accounts exist for the address, a single-use token is emailed inside a link to
 *    the front end's confirmation page. The caller always gets the same answer (the controller does not
 *    even wait for this method), so the endpoint never tells whether an address has an account.
 * 2. `preview(token)`: what confirming would delete, for the confirmation page. Does not use the token up.
 * 3. `confirm(token)`: uses the token up (atomically), deletes every account of the address, emails a
 *    confirmation, and keeps the request row as the audit record without the clear address.
 *
 * The token only ever reaches these three routes: it is not a JWT, carries no session and cannot sign
 * anybody in. Only its SHA-256 is stored.
 *
 * Runs on the TypeORM DataSource, which is up under every `DB_ORM` (see `MultiORMColumn`).
 */
@Injectable()
export class AccountDeletionService {
	private readonly logger = new Logger(AccountDeletionService.name);

	constructor(
		private readonly typeOrmAccountDeletionRequestRepository: TypeOrmAccountDeletionRequestRepository,
		@InjectDataSource() private readonly dataSource: DataSource,
		private readonly emailService: EmailService,
		@Optional() private readonly authenticatedUserCache?: AuthenticatedUserCache
	) {}

	/**
	 * Emails a deletion link when the address has accounts. Never throws and never reveals anything: the
	 * controller answers before this runs.
	 *
	 * @param input The request body.
	 * @param meta Client address and browser, for the audit record.
	 */
	async request(input: IAccountDeletionRequestInput, meta: AccountDeletionRequestMeta = {}): Promise<void> {
		const email = normalizeAccountDeletionEmail(input.email);
		const emailHash = hashAccountDeletionEmail(email);
		try {
			if (environment.demo && isDefaultProtectedUser(email)) {
				return;
			}

			const recent = await this.typeOrmAccountDeletionRequestRepository.count({
				where: { emailHash, createdAt: MoreThan(new Date(Date.now() - ACCOUNT_DELETION_EMAIL_WINDOW_MS)) }
			});
			if (recent >= ACCOUNT_DELETION_MAX_REQUESTS_PER_EMAIL) {
				this.logger.warn(`Account deletion request dropped: address limit reached (email ${short(emailHash)}).`);
				return;
			}

			const users = await this.findUsersByEmail(this.dataSource.manager, email);
			if (!users.length) {
				this.logger.debug(`Account deletion request for an address without accounts (email ${short(emailHash)}).`);
				return;
			}

			const now = new Date();
			const ttlMinutes = accountDeletionTtlMinutes();
			const token = generateAccountDeletionToken();

			// One live link per address: a newer request replaces any earlier one that was not used.
			await this.typeOrmAccountDeletionRequestRepository.update(
				{ emailHash, usedAt: IsNull(), revokedAt: IsNull() },
				{ revokedAt: now }
			);
			const created = await this.typeOrmAccountDeletionRequestRepository.save(
				this.typeOrmAccountDeletionRequestRepository.create({
					email,
					emailHash,
					tokenHash: hashAccountDeletionToken(token),
					expiresAt: new Date(now.getTime() + ttlMinutes * 60 * 1000),
					requestIpHash: hashAccountDeletionIp(meta.ip),
					userAgent: meta.userAgent ? meta.userAgent.slice(0, 255) : null,
					locale: input.locale || users[0].preferredLanguage || LanguagesEnum.ENGLISH
				})
			);

			await this.emailService.sendAccountDeletionLink({
				email,
				deletionLink: buildAccountDeletionLink(this.confirmUrl(input.callbackUrl), token),
				expiresInMinutes: ttlMinutes,
				locale: (created.locale as LanguagesEnum) || LanguagesEnum.ENGLISH,
				integration: this.integration(input)
			});
			this.logger.log(
				`Account deletion link sent: request ${created.id}, ${users.length} account(s), expires in ${ttlMinutes} min.`
			);
		} catch (error) {
			this.logger.error(`Account deletion request failed (email ${short(emailHash)}): ${error?.message}`);
		}
	}

	/**
	 * What confirming the link would delete.
	 *
	 * @param token The token from the link.
	 * @throws GoneException when the link is not (or no longer) valid.
	 */
	async preview(token: string): Promise<IAccountDeletionPreview> {
		const request = await this.findLiveRequest(token);
		const planned = await this.plan(this.dataSource.manager, request.email);
		return {
			email: maskAccountDeletionEmail(request.email),
			expiresAt: request.expiresAt,
			accounts: planned.map((item) => item.account)
		};
	}

	/**
	 * Uses the token up and deletes every account of its address.
	 *
	 * The token is consumed by one conditional UPDATE, so two concurrent confirms cannot both run. When the
	 * deletion itself fails the token is released again (until it expires), so the user can retry; accounts
	 * already deleted are simply not found the second time.
	 *
	 * @param token The token from the link.
	 * @throws GoneException when the link is not (or no longer) valid.
	 */
	async confirm(token: string): Promise<IAccountDeletionResult> {
		if (!isWellFormedAccountDeletionToken(token)) {
			throw new GoneException(ACCOUNT_DELETION_INVALID_LINK_MESSAGE);
		}
		const tokenHash = hashAccountDeletionToken(token);
		const now = new Date();

		const consumed = await this.typeOrmAccountDeletionRequestRepository
			.createQueryBuilder()
			.update(AccountDeletionRequest)
			.set({ usedAt: now })
			.where({ tokenHash, usedAt: IsNull(), revokedAt: IsNull(), expiresAt: MoreThan(now), email: Not(IsNull()) })
			.execute();
		if (consumed.affected !== 1) {
			throw new GoneException(ACCOUNT_DELETION_INVALID_LINK_MESSAGE);
		}

		const request = await this.typeOrmAccountDeletionRequestRepository.findOneBy({ tokenHash });
		const email = request.email;

		let accounts = 0;
		let workspacesDeleted = 0;
		const deletedUserIds: ID[] = [];
		try {
			const planned = await this.plan(this.dataSource.manager, email);
			for (const { user, account } of planned) {
				await this.dataSource.transaction(async (manager) => {
					await this.eraseAccount(manager, user, account.outcome);
				});
				deletedUserIds.push(user.id);
				accounts++;
				if (account.outcome === AccountDeletionOutcomeEnum.WORKSPACE_DELETED) {
					workspacesDeleted++;
				}
			}
		} catch (error) {
			this.logger.error(
				`Account deletion ${request.id} failed after ${accounts} account(s): ${error?.message}. Link released for a retry.`
			);
			await this.typeOrmAccountDeletionRequestRepository.update({ id: request.id }, { usedAt: null });
			throw error;
		} finally {
			for (const userId of deletedUserIds) {
				this.authenticatedUserCache?.forget(userId);
			}
		}

		// The audit record: from here on the row carries no clear address, only its hash and the counts.
		await this.typeOrmAccountDeletionRequestRepository.update(
			{ id: request.id },
			{ email: null, result: JSON.stringify({ accounts, workspacesDeleted, completedAt: now.toISOString() }) }
		);
		this.logger.log(
			`Account deletion ${request.id} completed: ${accounts} account(s), ${workspacesDeleted} workspace(s) (email ${short(
				request.emailHash
			)}).`
		);

		await this.emailService.sendAccountDeletionCompleted({
			email,
			accounts,
			workspacesDeleted,
			locale: (request.locale as LanguagesEnum) || LanguagesEnum.ENGLISH,
			integration: environment.appIntegrationConfig
		});

		return { deleted: true, accounts, workspacesDeleted };
	}

	/**
	 * The request a token belongs to, when it can still be used.
	 *
	 * @throws GoneException otherwise (one message for every reason).
	 */
	private async findLiveRequest(token: string): Promise<AccountDeletionRequest> {
		if (!isWellFormedAccountDeletionToken(token)) {
			throw new GoneException(ACCOUNT_DELETION_INVALID_LINK_MESSAGE);
		}
		const request = await this.typeOrmAccountDeletionRequestRepository.findOneBy({
			tokenHash: hashAccountDeletionToken(token),
			usedAt: IsNull(),
			revokedAt: IsNull(),
			expiresAt: MoreThan(new Date())
		});
		if (!request || !request.email) {
			throw new GoneException(ACCOUNT_DELETION_INVALID_LINK_MESSAGE);
		}
		return request;
	}

	/**
	 * Every account of an address, with what deleting it does.
	 *
	 * One Gauzy user exists per tenant ("workspace"). When nobody else uses the workspace, it goes as a
	 * whole; otherwise only the user's own account does, and `soleAdmin` warns when they are its last admin.
	 */
	private async plan(manager: EntityManager, email: string): Promise<PlannedAccount[]> {
		const users = await this.findUsersByEmail(manager, email);
		const planned: PlannedAccount[] = [];

		for (const user of users) {
			const otherMembers = user.tenantId
				? await manager.count(User, { where: { tenantId: user.tenantId, id: Not(user.id) } })
				: 0;
			const isAdmin = ADMIN_ROLES.includes(user.role?.name);
			const otherAdmins =
				otherMembers > 0 && isAdmin
					? await manager
							.getRepository(User)
							.createQueryBuilder('user')
							.innerJoin('user.role', 'role')
							.where('user.tenantId = :tenantId', { tenantId: user.tenantId })
							.andWhere('user.id != :userId', { userId: user.id })
							.andWhere('role.name IN (:...roles)', { roles: ADMIN_ROLES })
							.getCount()
					: 0;
			const memberships = await manager.find(UserOrganization, {
				where: { userId: user.id },
				relations: { organization: true }
			});

			planned.push({
				user,
				account: {
					workspace: user.tenant?.name || '',
					role: user.role?.name || null,
					organizations: memberships.map((membership) => membership.organization?.name).filter(Boolean),
					otherMembers,
					soleAdmin: isAdmin && otherMembers > 0 && otherAdmins === 0,
					outcome:
						user.tenantId && otherMembers === 0
							? AccountDeletionOutcomeEnum.WORKSPACE_DELETED
							: AccountDeletionOutcomeEnum.ACCOUNT_REMOVED
				}
			});
		}
		return planned;
	}

	/**
	 * Deletes one account, inside the caller's transaction.
	 *
	 * Authorship (`createdBy`/`updatedBy`/`deletedBy`) is cleared first so the cascade from `user` only
	 * takes the user's own rows (see {@link detachUserAuthorship}). A workspace nobody else uses is then
	 * deleted as a whole: every tenant-scoped row cascades from `tenant`, the user's included.
	 */
	private async eraseAccount(manager: EntityManager, user: User, outcome: AccountDeletionOutcomeEnum): Promise<void> {
		await detachUserAuthorship(manager, user.id);

		if (outcome === AccountDeletionOutcomeEnum.WORKSPACE_DELETED) {
			await manager.delete(Tenant, { id: user.tenantId });
		}
		// Also when the tenant went: a no-op then, and it covers a user row the tenant did not cascade to.
		await manager.delete(User, { id: user.id });
	}

	/** The active (not soft-deleted) users with this address, in every tenant, with their role and tenant. */
	private async findUsersByEmail(manager: EntityManager, email: string): Promise<User[]> {
		return await manager
			.getRepository(User)
			.createQueryBuilder('user')
			.leftJoinAndSelect('user.role', 'role')
			.leftJoinAndSelect('user.tenant', 'tenant')
			.where('LOWER(user.email) = :email', { email })
			.getMany();
	}

	/**
	 * The confirmation page the link points at: the caller's `callbackUrl` when its origin is one this
	 * deployment serves, otherwise `ACCOUNT_DELETION_CONFIRM_URL`, otherwise the Angular app's own page.
	 */
	private confirmUrl(callbackUrl?: string): string {
		const allowed = callbackUrl ? allowedEmailLink(callbackUrl) : null;
		if (callbackUrl && !allowed) {
			warnRejectedEmailLink(this.logger, 'the account deletion email')('callbackUrl', null);
		}
		return (
			allowed ||
			process.env['ACCOUNT_DELETION_CONFIRM_URL'] ||
			`${trimTrailingSlashes(environment.clientBaseUrl || '')}/#/auth/delete-account/confirm`
		);
	}

	/** The branding of the emails: the deployment's, overridden by the caller's where its links are allowed. */
	private integration(input: IAccountDeletionRequestInput) {
		const overrides = pick(input, ...INTEGRATION_FIELDS);
		return deepMerge(
			environment.appIntegrationConfig,
			withAllowedEmailLinks(overrides, warnRejectedEmailLink(this.logger, 'the account deletion email'))
		);
	}
}

/** The first 12 hex characters of a hash: enough to correlate log lines, not to look anything up. */
function short(hash: string): string {
	return (hash || '').slice(0, 12);
}

/** `url` without trailing slashes (a scan, not a regex: no backtracking on a long run of them). */
function trimTrailingSlashes(url: string): string {
	let end = url.length;
	while (end > 0 && url.charCodeAt(end - 1) === 47 /* '/' */) {
		end--;
	}
	return url.slice(0, end);
}
