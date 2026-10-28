import {
	ConflictException,
	ForbiddenException,
	GoneException,
	Injectable,
	Logger,
	Optional,
	ServiceUnavailableException
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager, IsNull, LessThan, MoreThan, Not } from 'typeorm';
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
import { allowedEmailLink, emailLinkOrigin, warnRejectedEmailLink, withAllowedEmailLinks } from '../auth/email-link-origin';
import { assertFirstPartyRequest } from '../auth/oauth-app-first-party';
import { AuthenticatedUserCache } from '../auth/strategies/authenticated-user-cache';
import { RequestContext } from '../core/context';
import { ImageAsset, Tenant, User, UserOrganization } from '../core/entities/internal';
import { EmailService } from '../email-send/email.service';
import { StripeSubscriptionService } from '../shared/billing/stripe-subscription.service';
import { isDefaultProtectedUser } from '../user/default-protected-users';
import {
	detachEmployeeReferences,
	detachUserReferences,
	employeeIdsOfUser,
	lockRowForUpdate,
	lockRowsForUpdate,
	sqlPlaceholder
} from '../user/user-authorship';
import {
	collectStoredFiles,
	deleteStoredFiles,
	deleteUnusedRows,
	isImageAssetShared,
	loadTenantSettings,
	StoredFile
} from './account-deletion-files';
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

/** The answer when what would be deleted changed since the preview (409): nothing was deleted. */
export const ACCOUNT_DELETION_PLAN_CHANGED_MESSAGE =
	'What would be deleted has changed since you reviewed it (for example, a member joined or left). Nothing was deleted: review it again.';

/** The answer when an account changed half-way: the ones before it were deleted, the rest were not. */
export const ACCOUNT_DELETION_PARTIAL_MESSAGE =
	'Some of your accounts were deleted, but what would be deleted for the others changed while we worked. Review what remains and confirm again.';

/**
 * How long a confirm holds its claim on a link without renewing it. The claim is renewed after every account,
 * and only by the confirm that holds it; a claim left alone longer (the process died mid-way) can be taken
 * again while the link has not expired, and the deletion then carries on.
 */
export const ACCOUNT_DELETION_CLAIM_LEASE_MS = 10 * 60 * 1000;

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

/** What a deletion removed, kept in the audit row (counts only). Cumulative across retries of one link. */
interface ErasureCounts {
	accounts: number;
	workspacesDeleted: number;
	filesDeleted: number;
	filesFailed: number;
	subscriptionsCancelled: number;
}

const NO_ERASURE: ErasureCounts = {
	accounts: 0,
	workspacesDeleted: 0,
	filesDeleted: 0,
	filesFailed: 0,
	subscriptionsCancelled: 0
};

/**
 * Deleting your account(s), from a link sent to your email address (without signing in), or from a session.
 *
 * 1. `request(email)`: when accounts exist for the address, a single-use token is emailed inside a link to
 *    the front end's confirmation page. The caller always gets the same answer (the controller does not
 *    even wait for this method), so the endpoint never tells whether an address has an account.
 * 2. `preview(token)`: what confirming would delete, and its `planHash`. Does not use the token up.
 * 3. `confirm(token, planHash)`: claims the token, deletes every account of the address with exactly the
 *    outcomes the user reviewed (else 409, nothing deleted), emails a confirmation, and keeps the request row
 *    as the audit record without the clear address.
 *
 * The token only ever reaches these routes: it is not a JWT, carries no session and cannot sign anybody in.
 * Only its SHA-256 is stored.
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
		@Optional() private readonly authenticatedUserCache?: AuthenticatedUserCache,
		@Optional() private readonly stripeSubscriptionService?: StripeSubscriptionService
	) {}

	/**
	 * Emails a deletion link when the address has accounts. Never throws and never reveals anything: the
	 * controller answers before this runs.
	 *
	 * Counting the recent requests, revoking the previous link and saving the new one happen under a lock per
	 * address (one transaction), so concurrent requests on several API instances cannot exceed the limit or
	 * leave two live links.
	 *
	 * @param input The request body.
	 * @param meta Client address and browser, for the audit record.
	 */
	async request(input: IAccountDeletionRequestInput, meta: AccountDeletionRequestMeta = {}): Promise<void> {
		const email = normalizeAccountDeletionEmail(input.email);
		const emailHash = hashAccountDeletionEmail(email);
		try {
			await this.scrubStaleAddresses();
			if (environment.demo && isDefaultProtectedUser(email)) {
				return;
			}

			const users = await this.findUsersByEmail(this.dataSource.manager, email);
			if (!users.length) {
				this.logger.debug(`Account deletion request for an address without accounts (email ${short(emailHash)}).`);
				return;
			}

			const ttlMinutes = accountDeletionTtlMinutes();
			const token = generateAccountDeletionToken();

			const created = await this.withAddressLock(emailHash, (manager) =>
				this.issueLink(manager, emailHash, email, token, ttlMinutes, input, meta, users[0])
			);
			if (!created) {
				this.logger.warn(`Account deletion request dropped: address limit reached (email ${short(emailHash)}).`);
				return;
			}

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
	 * Counts the address's recent requests, revokes its live link and saves the new one; under the caller's lock.
	 *
	 * @returns The new request, or null when the address reached its hourly limit.
	 */
	private async issueLink(
		manager: EntityManager,
		emailHash: string,
		email: string,
		token: string,
		ttlMinutes: number,
		input: IAccountDeletionRequestInput,
		meta: AccountDeletionRequestMeta,
		firstUser: User
	): Promise<AccountDeletionRequest | null> {
		const repository = manager.getRepository(AccountDeletionRequest);
		const recent = await repository.count({
			where: { emailHash, createdAt: MoreThan(new Date(Date.now() - ACCOUNT_DELETION_EMAIL_WINDOW_MS)) }
		});
		if (recent >= ACCOUNT_DELETION_MAX_REQUESTS_PER_EMAIL) {
			return null;
		}

		const now = new Date();
		// One live link per address: a newer request replaces any earlier one not yet claimed, and the replaced
		// row keeps only the hash of the address.
		await repository
			.createQueryBuilder()
			.update(AccountDeletionRequest)
			.set({ revokedAt: now, email: null })
			.where({ emailHash, usedAt: IsNull(), completedAt: IsNull(), revokedAt: IsNull() })
			.callListeners(false)
			.execute();
		return await repository.save(
			repository.create({
				email,
				emailHash,
				tokenHash: hashAccountDeletionToken(token),
				expiresAt: new Date(now.getTime() + ttlMinutes * 60 * 1000),
				requestIpHash: hashAccountDeletionIp(meta.ip),
				userAgent: meta.userAgent ? meta.userAgent.slice(0, 255) : null,
				locale: supportedLanguage(input.locale) || firstUser.preferredLanguage || LanguagesEnum.ENGLISH,
				branding: JSON.stringify(this.brandingOf(input))
			})
		);
	}

	/**
	 * What confirming the link would delete, with the `planHash` the confirm must send back.
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
			accounts: planned.map((item) => item.account),
			planHash: planHashOf(planned)
		};
	}

	/**
	 * Deletes every account of the link's address, exactly as previewed.
	 *
	 * - `planHash` must match what the accounts and outcomes are now; otherwise 409 and nothing happens (the
	 *   link stays usable).
	 * - The link is claimed by one conditional UPDATE, so two concurrent confirms cannot both run. The claim is
	 *   a lease: should the process die mid-way, the link works again after {@link ACCOUNT_DELETION_CLAIM_LEASE_MS}
	 *   (while it has not expired) and the deletion carries on; the counts are cumulative.
	 * - Each account goes in its own transaction, which locks the workspace and re-checks its outcome first
	 *   (a member joining in between makes it a 409, not a deleted member). When an account fails, the claim
	 *   is released so the user can retry; accounts already deleted are simply not found again.
	 *
	 * @throws GoneException when the link is not (or no longer) valid.
	 * @throws ConflictException when what would be deleted changed since the preview.
	 */
	async confirm(token: string, planHash: string): Promise<IAccountDeletionResult> {
		const request = await this.findLiveRequest(token);
		const planned = await this.plan(this.dataSource.manager, request.email);
		if (planHashOf(planned) !== planHash) {
			throw new ConflictException(ACCOUNT_DELETION_PLAN_CHANGED_MESSAGE);
		}

		const now = new Date();
		const claimed = await this.typeOrmAccountDeletionRequestRepository
			.createQueryBuilder()
			.update(AccountDeletionRequest)
			.set({ usedAt: now })
			.where({ id: request.id, revokedAt: IsNull(), completedAt: IsNull(), expiresAt: MoreThan(now) })
			.andWhere([{ usedAt: IsNull() }, { usedAt: LessThan(new Date(now.getTime() - ACCOUNT_DELETION_CLAIM_LEASE_MS)) }])
			.callListeners(false)
			.execute();
		if (claimed.affected !== 1) {
			throw new GoneException(ACCOUNT_DELETION_INVALID_LINK_MESSAGE);
		}

		const counts: ErasureCounts = { ...NO_ERASURE, ...parseCounts(request.result) };
		let claim = now;
		let deletedNow = 0;
		try {
			for (const item of planned) {
				add(counts, await this.eraseAccount(item, request.id, request.email));
				deletedNow++;
				// Progress survives a crash (a retry adds to these counts), and renews the claim: only while this
				// confirm still holds it, so a confirm that lost it stops instead of racing the one that took over.
				claim = await this.renewClaim(request.id, claim, { result: JSON.stringify(counts) });
			}
		} catch (error) {
			this.logger.error(
				`Account deletion ${request.id} stopped after ${counts.accounts} account(s): ${error?.message}. Link released for a retry.`
			);
			await this.releaseClaim(request.id, claim);
			if (deletedNow > 0 && error instanceof ConflictException) {
				throw new ConflictException(ACCOUNT_DELETION_PARTIAL_MESSAGE);
			}
			throw error;
		}

		// The audit record: from here on the row carries no clear address, only its hash and the counts. Not
		// swallowed: a link that stayed incomplete could be taken again once its lease ran out.
		await this.renewClaim(request.id, claim, {
			email: null,
			completedAt: new Date(),
			result: JSON.stringify({ ...counts, completedAt: new Date().toISOString() })
		});
		this.logger.log(
			`Account deletion ${request.id} completed: ${counts.accounts} account(s), ${counts.workspacesDeleted} workspace(s), ` +
				`${counts.filesDeleted} file(s) removed, ${counts.filesFailed} not (email ${short(request.emailHash)}).`
		);

		await this.emailService.sendAccountDeletionCompleted({
			email: request.email,
			accounts: counts.accounts,
			workspacesDeleted: counts.workspacesDeleted,
			allAccounts: true,
			locale: (request.locale as LanguagesEnum) || LanguagesEnum.ENGLISH,
			integration: deepMerge(environment.appIntegrationConfig, parseBranding(request.branding))
		});

		return { deleted: true, accounts: counts.accounts, workspacesDeleted: counts.workspacesDeleted };
	}

	/**
	 * What deleting the signed-in user's account (in the current workspace only) would do.
	 */
	async previewCurrentUser(): Promise<IAccountDeletionPreview> {
		const { planned, user } = await this.planCurrentUser();
		return {
			email: maskAccountDeletionEmail(user.email),
			expiresAt: null,
			accounts: planned.map((item) => item.account),
			planHash: planHashOf(planned)
		};
	}

	/**
	 * Deletes the signed-in user's account in the current workspace, with the same rules as the emailed link
	 * (the whole workspace when nobody else uses it, otherwise the account only) and the same `planHash` check.
	 * The session is the proof: accounts with the same address in other workspaces are left alone (the emailed
	 * link covers those). Writes the same audit row and sends a confirmation email that says so.
	 *
	 * @throws ConflictException when what would be deleted changed since the preview.
	 */
	async deleteCurrentUser(planHash: string, branding: Partial<IAccountDeletionRequestInput> = {}): Promise<IAccountDeletionResult> {
		assertFirstPartyRequest('Deleting a user account');
		const { planned, user } = await this.planCurrentUser();
		if (planHashOf(planned) !== planHash) {
			throw new ConflictException(ACCOUNT_DELETION_PLAN_CHANGED_MESSAGE);
		}

		const now = new Date();
		const email = normalizeAccountDeletionEmail(user.email);
		// Inserted without listeners: the base subscriber would stamp the session's user, deleted a moment later.
		const inserted = await this.typeOrmAccountDeletionRequestRepository
			.createQueryBuilder()
			.insert()
			.into(AccountDeletionRequest)
			.values({
				emailHash: hashAccountDeletionEmail(email),
				// No link was emailed: a random, never-revealed value keeps the column unique and unusable.
				tokenHash: hashAccountDeletionToken(generateAccountDeletionToken()),
				expiresAt: now,
				usedAt: now,
				locale: user.preferredLanguage || LanguagesEnum.ENGLISH
			})
			.callListeners(false)
			.execute();
		const auditId: ID = inserted.identifiers?.[0]?.id;

		const counts: ErasureCounts = { ...NO_ERASURE };
		for (const item of planned) {
			add(counts, await this.eraseAccount(item, auditId, email));
		}

		await this.saveAuditRow(auditId, {
			completedAt: new Date(),
			result: JSON.stringify({ ...counts, completedAt: new Date().toISOString(), via: 'session' })
		});
		this.logger.log(
			`Account deletion ${auditId} completed from a session: ${counts.accounts} account(s), ${counts.workspacesDeleted} workspace(s).`
		);
		await this.emailService.sendAccountDeletionCompleted({
			email,
			accounts: counts.accounts,
			workspacesDeleted: counts.workspacesDeleted,
			allAccounts: false,
			workspace: planned[0]?.account.workspace,
			locale: (user.preferredLanguage as LanguagesEnum) || LanguagesEnum.ENGLISH,
			integration: this.integration(branding)
		});
		return { deleted: true, accounts: counts.accounts, workspacesDeleted: counts.workspacesDeleted };
	}

	/** The signed-in user's account in the current workspace, planned like the emailed link's. */
	private async planCurrentUser(): Promise<{ user: User; planned: PlannedAccount[] }> {
		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();
		const user = userId ? await this.dataSource.manager.findOne(User, { where: { id: userId } }) : null;
		if (!user || !user.email || (tenantId && user.tenantId !== tenantId)) {
			throw new ForbiddenException('You are not allowed to delete this account.');
		}
		if (environment.demo && isDefaultProtectedUser(user.email)) {
			throw new ForbiddenException('This demo account cannot be deleted.');
		}
		const planned = (
			await this.plan(this.dataSource.manager, normalizeAccountDeletionEmail(user.email))
		).filter((item) => item.user.id === user.id);
		if (!planned.length) {
			throw new ForbiddenException('You are not allowed to delete this account.');
		}
		return { user, planned };
	}

	/**
	 * Deletes one account in its own transaction:
	 *
	 * 1. locks the workspace (rows that would reference it, a joining member's included, wait) and the user,
	 *    and re-checks the outcome the user reviewed: a change is a 409 and nothing is deleted;
	 * 2. when the whole workspace goes, cancels its billing subscription first (a failure stops here: a deleted
	 *    workspace must not go on being charged);
	 * 3. clears the user's and their members' references from rows that are not theirs (shared content stays);
	 * 4. removes the stored files that go with the rows (with the owning tenant's storage settings);
	 * 5. deletes the workspace (everything cascades from `tenant`) or the account, and a profile picture
	 *    nothing else uses.
	 *
	 * Files are removed before the rows: if the transaction then fails, the rows remain without their files,
	 * and a retry finishes the deletion; the other order would lose the keys of files left in the bucket.
	 */
	private async eraseAccount({ user, account }: PlannedAccount, auditId: ID, email: string): Promise<ErasureCounts> {
		const result = await this.dataSource.transaction(async (manager): Promise<ErasureCounts> => {
			if (user.tenantId) {
				await lockRowForUpdate(manager, 'tenant', user.tenantId);
			}
			if (!(await lockRowForUpdate(manager, 'user', user.id))) {
				return { ...NO_ERASURE }; // Already deleted by an earlier attempt.
			}
			// The account must still be the one planned: same address (it may have been changed meanwhile, and the
			// link only proves the old one) and same outcome.
			if (
				normalizeAccountDeletionEmail(await this.emailOf(manager, user.id)) !== normalizeAccountDeletionEmail(email) ||
				(await this.outcomeOf(manager, user)) !== account.outcome
			) {
				throw new ConflictException(ACCOUNT_DELETION_PLAN_CHANGED_MESSAGE);
			}
			const employeeIds = await employeeIdsOfUser(manager, user.id);
			// Nothing may start pointing at these members between the scan of their references and the delete.
			await lockRowsForUpdate(manager, 'employee', employeeIds);
			const wholeWorkspace = account.outcome === AccountDeletionOutcomeEnum.WORKSPACE_DELETED;

			let subscriptionsCancelled = 0;
			if (wholeWorkspace) {
				subscriptionsCancelled = await this.cancelBilling(manager, user.tenantId);
			}

			const files = await collectStoredFiles(
				manager,
				wholeWorkspace ? { kind: 'workspace', tenantId: user.tenantId } : { kind: 'user', userId: user.id }
			);
			const avatarId = !wholeWorkspace && user.imageId ? user.imageId : null;
			const avatarGoes = !!avatarId && !(await isImageAssetShared(manager, avatarId, user.id));
			if (avatarGoes) {
				files.push(...(await this.avatarFiles(manager, avatarId)));
			}
			const tenantSettings = user.tenantId ? await loadTenantSettings(manager, user.tenantId) : null;

			// The member records' contact rows (postal address, fiscal details) are separate rows: read them now,
			// delete the ones nothing else uses once the members are gone.
			const contactIds = wholeWorkspace ? [] : await this.contactIdsOf(manager, user.id);

			await detachUserReferences(manager, user.id);
			await detachEmployeeReferences(manager, employeeIds);

			const removed = await deleteStoredFiles(files, tenantSettings);

			if (wholeWorkspace) {
				await manager.delete(Tenant, { id: user.tenantId });
			}
			// Also when the tenant went: a no-op then, and it covers a user row the tenant did not cascade to.
			await manager.delete(User, { id: user.id });
			if (avatarGoes) {
				await manager.delete(ImageAsset, { id: avatarId });
			}
			await deleteUnusedRows(manager, 'contact', contactIds);

			return {
				accounts: 1,
				workspacesDeleted: wholeWorkspace ? 1 : 0,
				filesDeleted: removed.deleted,
				filesFailed: removed.failed,
				subscriptionsCancelled
			};
		});
		this.authenticatedUserCache?.forget(user.id);
		if (result.filesFailed) {
			this.logger.warn(`Account deletion ${auditId}: ${result.filesFailed} stored file(s) could not be removed.`);
		}
		return result;
	}

	/**
	 * Cancels the billing subscription of a workspace that is about to be deleted.
	 *
	 * @throws ServiceUnavailableException when it could not be cancelled: nothing is deleted then.
	 */
	private async cancelBilling(manager: EntityManager, tenantId: ID): Promise<number> {
		if (!this.stripeSubscriptionService) {
			return 0;
		}
		const tenant = await manager.findOne(Tenant, { where: { id: tenantId }, select: { id: true, stripeCustomerId: true } });
		if (!tenant?.stripeCustomerId) {
			return 0;
		}
		try {
			return await this.stripeSubscriptionService.cancelCustomerSubscriptions(tenant.stripeCustomerId);
		} catch (error) {
			this.logger.error(`Billing of workspace ${tenantId} could not be cancelled: ${error?.message}`);
			throw new ServiceUnavailableException(
				'The subscription of this workspace could not be cancelled, so nothing was deleted. Please try again later.'
			);
		}
	}

	/** The profile picture's own files, unless another image row uses the same file. */
	private async avatarFiles(manager: EntityManager, imageId: ID): Promise<StoredFile[]> {
		const driver = manager.connection.driver;
		const p = (n: number) => sqlPlaceholder(manager, n);
		const [image] = await manager.query(
			`SELECT ${driver.escape('url')} AS ${driver.escape('url')}, ${driver.escape('thumb')} AS ${driver.escape(
				'thumb'
			)}, ${driver.escape('storageProvider')} AS ${driver.escape('provider')} FROM ${driver.escape(
				'image_asset'
			)} WHERE ${driver.escape('id')} = ${p(1)}`,
			[imageId]
		);
		const files: StoredFile[] = [];
		for (const key of [image?.url, image?.thumb]) {
			if (!key || /^https?:\/\//i.test(key)) continue;
			const others = await manager.query(
				`SELECT 1 FROM ${driver.escape('image_asset')} WHERE (${driver.escape('url')} = ${p(1)} OR ${driver.escape(
					'thumb'
				)} = ${p(2)}) AND ${driver.escape('id')} <> ${p(3)}`,
				[key, key, imageId]
			);
			if (!others.length) {
				files.push({ table: 'image_asset', provider: image.provider, key });
			}
		}
		return files;
	}

	/** The contacts of the user's member and candidate records (address, fiscal details), soft-deleted included. */
	private async contactIdsOf(manager: EntityManager, userId: ID): Promise<ID[]> {
		const driver = manager.connection.driver;
		const ids: ID[] = [];
		for (const table of ['employee', 'candidate']) {
			const metadata = manager.connection.entityMetadatas.find((candidate) => candidate.tablePath === table);
			if (!metadata?.columns.some((column) => column.databaseName === 'contactId')) continue;
			const rows: Array<{ contactId: ID }> = await manager.query(
				`SELECT ${driver.escape('contactId')} AS ${driver.escape('contactId')} FROM ${driver.escape(table)} WHERE ${driver.escape(
					'userId'
				)} = ${sqlPlaceholder(manager, 1)} AND ${driver.escape('contactId')} IS NOT NULL`,
				[userId]
			);
			ids.push(...rows.map((row) => row.contactId));
		}
		return [...new Set(ids)];
	}

	/** The user's address as stored now (read under the row lock). */
	private async emailOf(manager: EntityManager, userId: ID): Promise<string> {
		const driver = manager.connection.driver;
		const [row] = await manager.query(
			`SELECT ${driver.escape('email')} AS ${driver.escape('email')} FROM ${driver.escape('user')} WHERE ${driver.escape(
				'id'
			)} = ${sqlPlaceholder(manager, 1)}`,
			[userId]
		);
		return row?.email || '';
	}

	/**
	 * Writes to a claimed request's row and renews the claim, only while this confirm still holds it (its
	 * `usedAt` is unchanged). Without listeners, like {@link saveAuditRow}.
	 *
	 * @returns The renewed claim.
	 * @throws GoneException when another confirm took the claim over (this one stalled past the lease).
	 */
	private async renewClaim(id: ID, claim: Date, values: Partial<AccountDeletionRequest>): Promise<Date> {
		const renewed = new Date();
		const result = await this.typeOrmAccountDeletionRequestRepository
			.createQueryBuilder()
			.update(AccountDeletionRequest)
			.set({ ...values, usedAt: renewed })
			.where({ id, usedAt: claim })
			.callListeners(false)
			.execute();
		if (result.affected !== 1) {
			throw new GoneException(ACCOUNT_DELETION_INVALID_LINK_MESSAGE);
		}
		return renewed;
	}

	/** Gives the claim back (after a failure), only if this confirm still holds it. */
	private async releaseClaim(id: ID, claim: Date): Promise<void> {
		try {
			await this.typeOrmAccountDeletionRequestRepository
				.createQueryBuilder()
				.update(AccountDeletionRequest)
				.set({ usedAt: null })
				.where({ id, usedAt: claim, completedAt: IsNull() })
				.callListeners(false)
				.execute();
		} catch (error) {
			this.logger.error(`Account deletion ${id}: the claim could not be released: ${error?.message}`);
		}
	}

	/**
	 * Writes to the audit row without entity listeners: the base subscriber would stamp `updatedByUserId` with
	 * the signed-in user, who may no longer exist (a foreign key error that turned a finished deletion into a
	 * 500). A failure here is logged and swallowed: the deletion itself is done (or already being reported).
	 */
	private async saveAuditRow(id: ID, values: Partial<AccountDeletionRequest>): Promise<void> {
		if (!id) return;
		try {
			await this.typeOrmAccountDeletionRequestRepository
				.createQueryBuilder()
				.update(AccountDeletionRequest)
				.set(values)
				.where({ id })
				.callListeners(false)
				.execute();
		} catch (error) {
			this.logger.error(`Account deletion ${id}: the audit row could not be updated: ${error?.message}`);
		}
	}

	/**
	 * Runs `work` in a transaction that holds a per-address lock until it commits or rolls back: a Postgres
	 * advisory transaction lock on the address hash; on MySQL a named lock taken on the transaction's own
	 * connection before it starts and released after it ends (failing closed when it cannot be taken). SQLite
	 * serializes writers anyway.
	 */
	private async withAddressLock<T>(emailHash: string, work: (manager: EntityManager) => Promise<T>): Promise<T> {
		const type = this.dataSource.driver.options.type;
		if (type !== 'mysql') {
			return await this.dataSource.transaction(async (manager) => {
				if (type === 'postgres') {
					await manager.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
						`account-deletion:${emailHash}`
					]);
				}
				return await work(manager);
			});
		}

		const name = `gauzy:account-deletion:${emailHash.slice(0, 32)}`;
		const runner = this.dataSource.createQueryRunner();
		await runner.connect();
		try {
			const [row] = await runner.query('SELECT GET_LOCK(?, 10) AS `acquired`', [name]);
			if (Number(row?.acquired) !== 1) {
				throw new Error('the per-address lock could not be taken');
			}
			try {
				await runner.startTransaction();
				try {
					const result = await work(runner.manager);
					await runner.commitTransaction();
					return result;
				} catch (error) {
					await runner.rollbackTransaction();
					throw error;
				}
			} finally {
				await runner.query('SELECT RELEASE_LOCK(?)', [name]);
			}
		} finally {
			await runner.release();
		}
	}

	/**
	 * Clears the clear address from requests that can no longer complete (expired or replaced by a newer
	 * request), so an unconfirmed request keeps only its hash. Done on every new request: the table only ever
	 * holds a handful of live rows, and no scheduler is needed.
	 */
	private async scrubStaleAddresses(): Promise<void> {
		await this.typeOrmAccountDeletionRequestRepository
			.createQueryBuilder()
			.update(AccountDeletionRequest)
			.set({ email: null })
			.where({ email: Not(IsNull()), completedAt: IsNull() })
			.andWhere([{ expiresAt: LessThan(new Date()) }, { revokedAt: Not(IsNull()) }])
			.callListeners(false)
			.execute();
	}

	/**
	 * The request a token belongs to, when it can still be used: not revoked, not completed, not expired, and
	 * not claimed by a confirm that is still running (a claim older than the lease is fair game).
	 *
	 * @throws GoneException otherwise (one message for every reason).
	 */
	private async findLiveRequest(token: string): Promise<AccountDeletionRequest> {
		if (!isWellFormedAccountDeletionToken(token)) {
			throw new GoneException(ACCOUNT_DELETION_INVALID_LINK_MESSAGE);
		}
		const now = Date.now();
		const request = await this.typeOrmAccountDeletionRequestRepository.findOneBy({
			tokenHash: hashAccountDeletionToken(token),
			revokedAt: IsNull(),
			completedAt: IsNull(),
			expiresAt: MoreThan(new Date(now))
		});
		const claimed = request?.usedAt && new Date(request.usedAt).getTime() > now - ACCOUNT_DELETION_CLAIM_LEASE_MS;
		if (!request || !request.email || claimed) {
			throw new GoneException(ACCOUNT_DELETION_INVALID_LINK_MESSAGE);
		}
		return request;
	}

	/**
	 * Every account of an address, with what deleting it does.
	 *
	 * One Gauzy user exists per tenant ("workspace"). When nobody else uses the workspace, it goes as a
	 * whole; otherwise only the user's own account does, and `soleAdmin` warns when they are its last admin.
	 * Soft-deleted accounts count on both sides: one with this address is deleted too, and another member's
	 * soft-deleted (restorable) account keeps the workspace from being deleted whole.
	 */
	private async plan(manager: EntityManager, email: string): Promise<PlannedAccount[]> {
		const users = await this.findUsersByEmail(manager, email);
		const planned: PlannedAccount[] = [];

		for (const user of users) {
			const otherMembers = await this.otherMembersOf(manager, user);
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
					outcome: outcomeFor(user, otherMembers)
				}
			});
		}
		return planned;
	}

	/** The outcome for one account, counted again (inside the erasing transaction, under its lock). */
	private async outcomeOf(manager: EntityManager, user: User): Promise<AccountDeletionOutcomeEnum> {
		return outcomeFor(user, await this.otherMembersOf(manager, user));
	}

	/** The other users of the account's workspace, soft-deleted ones included. */
	private async otherMembersOf(manager: EntityManager, user: User): Promise<number> {
		if (!user.tenantId) {
			return 0;
		}
		return await manager.count(User, { where: { tenantId: user.tenantId, id: Not(user.id) }, withDeleted: true });
	}

	/** The users with this address in every tenant, soft-deleted ones included, with their role and tenant. */
	private async findUsersByEmail(manager: EntityManager, email: string): Promise<User[]> {
		return await manager
			.getRepository(User)
			.createQueryBuilder('user')
			.withDeleted()
			.leftJoinAndSelect('user.role', 'role')
			.leftJoinAndSelect('user.tenant', 'tenant')
			.where('LOWER(TRIM(user.email)) = :email', { email })
			.orderBy('user.id', 'ASC')
			.getMany();
	}

	/**
	 * The confirmation page the link points at: the caller's `callbackUrl` when its origin is one this
	 * deployment serves, otherwise `ACCOUNT_DELETION_CONFIRM_URL`, otherwise the Angular app's own page.
	 */
	private confirmUrl(callbackUrl?: string): string {
		const allowed = callbackUrl ? allowedEmailLink(callbackUrl) : null;
		if (callbackUrl && !allowed) {
			warnRejectedEmailLink(this.logger, 'the account deletion email')('callbackUrl', emailLinkOrigin(callbackUrl));
		}
		return (
			allowed ||
			process.env['ACCOUNT_DELETION_CONFIRM_URL'] ||
			`${trimTrailingSlashes(environment.clientBaseUrl || '')}/#/auth/delete-account/confirm`
		);
	}

	/** The branding of the emails: the deployment's, overridden by the caller's where its links are allowed. */
	private integration(input: Partial<IAccountDeletionRequestInput>) {
		return deepMerge(environment.appIntegrationConfig, this.brandingOf(input));
	}

	/** The caller's branding fields, with every link not on an origin this deployment serves dropped. */
	private brandingOf(input: Partial<IAccountDeletionRequestInput>): Record<string, unknown> {
		return withAllowedEmailLinks(
			pick(input, ...INTEGRATION_FIELDS),
			warnRejectedEmailLink(this.logger, 'the account deletion email')
		);
	}
}

/** The whole workspace when nobody else (not even a soft-deleted member) is in it, otherwise the account only. */
function outcomeFor(user: User, otherMembers: number): AccountDeletionOutcomeEnum {
	return user.tenantId && otherMembers === 0
		? AccountDeletionOutcomeEnum.WORKSPACE_DELETED
		: AccountDeletionOutcomeEnum.ACCOUNT_REMOVED;
}

/**
 * Fingerprint of what a confirm would delete: which accounts, in which workspaces, with which outcome, and
 * whether the user is a workspace's last admin (the warning they were shown). Holds
 * no readable data (ids are hashed together), so it can travel through the browser.
 */
export function planHashOf(
	planned: Array<{ user: Pick<User, 'id' | 'tenantId'>; account: Pick<IAccountDeletionAccount, 'outcome' | 'soleAdmin'> }>
): string {
	const parts = planned
		.map(({ user, account }) => `${user.id}|${user.tenantId || ''}|${account.outcome}|${account.soleAdmin ? 1 : 0}`)
		.sort();
	return createHash('sha256').update(parts.join('\n'), 'utf8').digest('hex').slice(0, 32);
}

/** The branding stored with a request, or nothing when it is missing or unreadable. */
function parseBranding(branding?: string | null): Record<string, unknown> {
	if (!branding) return {};
	try {
		const parsed = JSON.parse(branding);
		return parsed && typeof parsed === 'object' ? pick(parsed, ...INTEGRATION_FIELDS) : {};
	} catch {
		return {};
	}
}

/** The counts kept in an audit row from an earlier, incomplete attempt. */
function parseCounts(result?: string | null): Partial<ErasureCounts> {
	if (!result) return {};
	try {
		const parsed = JSON.parse(result);
		const counts: Partial<ErasureCounts> = {};
		for (const key of Object.keys(NO_ERASURE) as Array<keyof ErasureCounts>) {
			if (Number.isFinite(parsed?.[key])) counts[key] = parsed[key];
		}
		return counts;
	} catch {
		return {};
	}
}

function add(total: ErasureCounts, more: ErasureCounts): void {
	for (const key of Object.keys(NO_ERASURE) as Array<keyof ErasureCounts>) {
		total[key] += more[key];
	}
}

/** `locale` (or its language part, `pt-BR` → `pt`) when Gauzy has emails in it, otherwise undefined. */
function supportedLanguage(locale?: string): LanguagesEnum | undefined {
	const languages = Object.values(LanguagesEnum) as string[];
	for (const candidate of [locale, locale?.split(/[-_]/)[0]]) {
		const normalized = candidate?.toLowerCase();
		if (normalized && languages.includes(normalized)) {
			return normalized as LanguagesEnum;
		}
	}
	return undefined;
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
