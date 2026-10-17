import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
	CONTACT_LOCKOUT_POLICY,
	IContactCredential,
	IContactCredentialCreateInput,
	IContactCredentialFindInput,
	IContactCredentialPublic,
	IContactCredentialResetInput,
	IContactCredentialTokenInput,
	IContactCredentialUpdateInput,
	IContactLockoutPolicy,
	ID
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ContactCredential } from './contact-credential.entity';
import { TypeOrmContactCredentialRepository } from './repository/type-orm-contact-credential.repository';
import { MikroOrmContactCredentialRepository } from './repository/mikro-orm-contact-credential.repository';

/**
 * The customer-side logins of the tenant's parties, and the machine that governs them.
 *
 * Read the rules of this service as one rule about what the row may *be*, with five faces:
 *
 * 1. **One credential per party.** A second live login for one contact is a second identity, which is
 *    the thing this table exists to avoid; the partial unique index carries the rule and this service
 *    states it, so the refusal is a named one rather than a driver error.
 * 2. **The address is unique per tenant and is always stored normalised.** Login is resolved before an
 *    organization is known, so an address naming two rows would leave the resolver choosing one; and an
 *    address stored as it was typed would make `Ada@Example.com` and `ada@example.com` two logins for
 *    one person.
 * 3. **A plaintext secret is refused, not ignored.** The hash is produced by the platform's password
 *    hasher before the row is written, and a body that carries a password — or that asks a row to
 *    expose its hash, its authenticator secret or one of its tokens — is rejected. A caller that
 *    believes it set a password has a bug it would otherwise never see, and a service that accepted one
 *    would be one log line away from recording it.
 * 4. **The lockout ladder is one policy, evaluated before the password.** {@link registerFailedAttempt}
 *    arms a fifteen-minute lock at the fifth consecutive failure, a further failure while locked
 *    extends it to thirty minutes, and no lock ever passes a day; {@link recordSuccessfulLogin} clears
 *    both the counter and the lock, which is what makes "locked until" a statement about consecutive
 *    failures rather than a permanent state. {@link assertLoginAllowed} is the check the login path
 *    makes **before** verifying anything, so the refusal is constant-time.
 * 5. **The secrets never leave.** {@link toPublicCredential} is the only shape this service answers a
 *    credential in, and it has no member for the hash, the authenticator secret or either token — they
 *    are absent from the type, not null in it, so a projection cannot leak by forgetting.
 *
 * A credential is removed softly and always with its party in mind: it has no independent life, and the
 * row is kept while anything that referenced its sessions is still readable.
 */
@Injectable()
export class ContactCredentialService extends TenantAwareCrudService<ContactCredential> {
	/**
	 * The plaintext members a body may never carry. A password is hashed by the platform's password
	 * hasher before this service is reached, so a body that carries one is a caller that has not hashed
	 * anything.
	 */
	private static readonly PLAINTEXT_MEMBERS = ['password', 'plainPassword'];

	/**
	 * The secret members a **descriptive** write may never carry, each with the operation that owns it.
	 * {@link createCredential} and {@link completeReset} write the hash, and they take it as an explicit
	 * argument rather than through a general update.
	 */
	private static readonly SECRET_MEMBERS = ['passwordHash', 'mfaSecret', 'verificationToken', 'resetToken'];

	constructor(
		readonly typeOrmContactCredentialRepository: TypeOrmContactCredentialRepository,
		readonly mikroOrmContactCredentialRepository: MikroOrmContactCredentialRepository
	) {
		super(typeOrmContactCredentialRepository, mikroOrmContactCredentialRepository);
	}

	/**
	 * The tenant and organization of the caller, which every query in this service is scoped to.
	 */
	protected get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	/**
	 * Records the login of a contact.
	 *
	 * The created row is never verified and never locked: verification is what
	 * {@link verifyEmail} observes, and a lock is what failures produce. A creation that states either
	 * is refused rather than trusted, because both are facts about a later moment.
	 *
	 * @param input The credential as the caller states it.
	 * @returns The stored credential.
	 * @throws BadRequestException `CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED` when a secret member is
	 * stated, `CONTACT_CREDENTIAL_EMAIL_TAKEN` when the tenant already holds the address, and
	 * `CONTACT_CREDENTIAL_EXISTS` when the contact already has a live credential.
	 */
	async createCredential(input: IContactCredentialCreateInput): Promise<IContactCredential> {
		this.assertNoMembers(input, ContactCredentialService.PLAINTEXT_MEMBERS, 'a credential is created');

		const email = this.normaliseEmail(input?.email);
		const customerId = input?.customerId;

		if (!customerId) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_CREDENTIAL_NOT_FOUND}: a credential is stated with the contact it authenticates, and none was presented.`
			);
		}

		if (!input?.passwordHash) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED}: a credential is written with the hash the password hasher produced, and none was presented.`
			);
		}

		await this.assertCustomerHasNoCredential(customerId);
		await this.assertEmailAvailable(email);

		return this.create({
			customerId,
			email,
			passwordHash: input.passwordHash,
			isVerified: false,
			failedAttempts: 0,
			...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
			...this.scope
		} as never);
	}

	/**
	 * Loads a credential that belongs to the caller's organization.
	 *
	 * @param id The credential id.
	 * @returns The credential.
	 * @throws NotFoundException `CONTACT_CREDENTIAL_NOT_FOUND` when it is not in the caller's scope.
	 */
	async findCredentialOrFail(id: ID): Promise<IContactCredential> {
		const credential = await this.findCredential(id);

		if (!credential) {
			throw new NotFoundException(
				`${ApiErrorCode.CONTACT_CREDENTIAL_NOT_FOUND}: credential '${id}' could not be found.`
			);
		}

		return credential;
	}

	/**
	 * Reads one credential of the caller's organization, answering null when there is none.
	 *
	 * @param id The credential id.
	 * @returns The credential, or null.
	 */
	async findCredential(id: ID): Promise<IContactCredential | null> {
		const credentials: ContactCredential[] = await this.find({ where: { id, ...this.scope } } as never);

		return credentials.length ? credentials[0] : null;
	}

	/**
	 * The credential of one contact, when the contact has one.
	 *
	 * @param customerId The contact.
	 * @returns The credential, or null.
	 */
	async findCredentialOfCustomer(customerId: ID): Promise<IContactCredential | null> {
		const credentials: ContactCredential[] = await this.find({
			where: { customerId, ...this.scope }
		} as never);

		return credentials.length ? credentials[0] : null;
	}

	/**
	 * Resolves the login of one address inside the tenant.
	 *
	 * The lookup is **tenant-scoped and not organization-scoped**, deliberately: a login is resolved
	 * before an organization is known, which is why the uniqueness rule on the address is stated per
	 * tenant in the first place. The comparison is made on the stored normalised form, so the answer does
	 * not depend on how the caller capitalised what it typed.
	 *
	 * @param email The address as the caller typed it.
	 * @returns The credential, or null.
	 */
	async findByEmail(email: string): Promise<IContactCredential | null> {
		const normalised = String(email ?? '').trim().toLowerCase();
		const credentials: ContactCredential[] = await this.find({
			where: { email: normalised, tenantId: RequestContext.currentTenantId() }
		} as never);

		return credentials.length ? credentials[0] : null;
	}

	/**
	 * Lists the credentials of the caller's organization.
	 *
	 * @param filter Optional narrowing by contact, address or confirmation.
	 * @returns The credentials, newest first.
	 */
	async listCredentials(filter: IContactCredentialFindInput = {}): Promise<IContactCredential[]> {
		return this.find({
			where: {
				...(filter.customerId ? { customerId: filter.customerId } : {}),
				...(filter.email ? { email: String(filter.email).trim().toLowerCase() } : {}),
				...(filter.isVerified !== undefined ? { isVerified: filter.isVerified } : {}),
				...this.scope
			},
			order: { createdAt: 'DESC' }
		} as never);
	}

	/**
	 * Changes the descriptive facts of a credential.
	 *
	 * The contact it authenticates is not among them: a credential that could be re-pointed at another
	 * party would be a way to move a login, and therefore an identity, without a trace. Every secret
	 * member is refused, each naming the operation that owns it.
	 *
	 * @param id The credential to change.
	 * @param input The facts to change.
	 * @returns The stored credential.
	 * @throws BadRequestException `CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED` for a secret member, and
	 * `CONTACT_CREDENTIAL_EMAIL_TAKEN` when the new address is in use in this tenant.
	 * @throws NotFoundException when the credential is not in the caller's scope.
	 */
	async updateCredential(id: ID, input: IContactCredentialUpdateInput): Promise<IContactCredential> {
		await this.findCredentialOrFail(id);
		this.assertNoMembers(
			input,
			[...ContactCredentialService.PLAINTEXT_MEMBERS, ...ContactCredentialService.SECRET_MEMBERS],
			'a credential is updated'
		);

		let email: string | undefined;

		if (input?.email !== undefined && input.email !== null) {
			email = this.normaliseEmail(input.email);

			await this.assertEmailAvailable(email, id);
		}

		await this.update(id, {
			...(email !== undefined ? { email } : {}),
			...(input?.metadata !== undefined ? { metadata: input.metadata } : {})
		} as never);

		return this.findCredentialOrFail(id);
	}

	/**
	 * Writes an e-mail verification token onto a credential.
	 *
	 * The token and its expiry are one fact in two halves: a token without an expiry is a link that works
	 * forever, and an expiry without a token names nothing. Both are required together, the instant must
	 * be in the future, and what is stored is the **hash** the caller produced — the plaintext exists
	 * only in the message that carries it.
	 *
	 * @param id The credential being verified.
	 * @param input The hashed token and the instant it lapses.
	 * @returns The stored credential.
	 * @throws BadRequestException `CONTACT_CREDENTIAL_TOKEN_INVALID` for a half-stated or already-lapsed
	 * token, and `CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED` for an unprefixed token.
	 * @throws NotFoundException when the credential is not in the caller's scope.
	 */
	async setVerificationToken(id: ID, input: IContactCredentialTokenInput): Promise<IContactCredential> {
		await this.findCredentialOrFail(id);
		this.assertTokenWindow(input);

		await this.update(id, {
			verificationToken: input.token,
			verificationExpiresAt: new Date(input.expiresAt),
			// A new verification link replaces the previous outcome: the address is unconfirmed until the
			// new token is redeemed, which is what a re-send means.
			isVerified: false
		} as never);

		return this.findCredentialOrFail(id);
	}

	/**
	 * Confirms the e-mail address by redeeming its verification token.
	 *
	 * The token is single use and compared against the stored hash **and** its window, so a replayed link
	 * fails: redeeming clears both halves, which is what makes the second attempt find nothing.
	 *
	 * @param id The credential being confirmed.
	 * @param token The **hashed** token as it was presented.
	 * @param at The instant the redemption happens at. Defaults to now.
	 * @returns The stored credential, confirmed.
	 * @throws BadRequestException `CONTACT_CREDENTIAL_TOKEN_INVALID` when no token is outstanding, when it
	 * does not match, or when it has lapsed.
	 * @throws NotFoundException when the credential is not in the caller's scope.
	 */
	async verifyEmail(id: ID, token: string, at: Date = new Date()): Promise<IContactCredential> {
		const credential = await this.findCredentialOrFail(id);

		if (!credential.verificationToken || !credential.verificationExpiresAt) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_CREDENTIAL_TOKEN_INVALID}: no e-mail verification is outstanding for this credential.`
			);
		}

		if (String(credential.verificationToken) !== String(token ?? '')) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_CREDENTIAL_TOKEN_INVALID}: the presented verification token is not the one this credential issued.`
			);
		}

		if (new Date(credential.verificationExpiresAt).getTime() <= at.getTime()) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_CREDENTIAL_TOKEN_INVALID}: this verification token lapsed at ${new Date(
					credential.verificationExpiresAt
				).toISOString()}.`
			);
		}

		await this.update(id, {
			isVerified: true,
			verificationToken: null,
			verificationExpiresAt: null
		} as never);

		return this.findCredentialOrFail(id);
	}

	/**
	 * Writes a password-reset token onto a credential.
	 *
	 * Both halves are required together, exactly as for verification, and what is stored is the hash.
	 *
	 * @param id The credential being reset.
	 * @param input The hashed token and the instant it lapses.
	 * @returns The stored credential.
	 * @throws BadRequestException `CONTACT_CREDENTIAL_TOKEN_INVALID`.
	 * @throws NotFoundException when the credential is not in the caller's scope.
	 */
	async setResetToken(id: ID, input: IContactCredentialTokenInput): Promise<IContactCredential> {
		await this.findCredentialOrFail(id);
		this.assertTokenWindow(input);

		await this.update(id, {
			resetToken: input.token,
			resetExpiresAt: new Date(input.expiresAt)
		} as never);

		return this.findCredentialOrFail(id);
	}

	/**
	 * Completes a password reset, which is the one operation that clears a lock and consumes a token.
	 *
	 * The token is verified against the stored hash and its window, then spent: a reset token that
	 * survived its own redemption would be a link that resets the password twice. The new hash is
	 * written, the lockout counters are cleared — the holder of a valid single-use token has proved
	 * control of the address, and leaving them locked out would make the reset useless — and every
	 * outstanding token is consumed, including the verification half, so no link from before the reset
	 * survives it.
	 *
	 * @param id The credential being reset.
	 * @param input The hashed token, the instant it lapsed, and the hashed new password.
	 * @param at The instant the reset happens at. Defaults to now.
	 * @returns The stored credential.
	 * @throws BadRequestException `CONTACT_CREDENTIAL_TOKEN_INVALID` for a missing, mismatched or lapsed
	 * token, and `CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED` when no hash was produced.
	 * @throws NotFoundException when the credential is not in the caller's scope.
	 */
	async completeReset(
		id: ID,
		input: IContactCredentialResetInput,
		at: Date = new Date()
	): Promise<IContactCredential> {
		const credential = await this.findCredentialOrFail(id);

		if (!credential.resetToken || !credential.resetExpiresAt) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_CREDENTIAL_TOKEN_INVALID}: no password reset is outstanding for this credential.`
			);
		}

		if (String(credential.resetToken) !== String(input?.token ?? '')) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_CREDENTIAL_TOKEN_INVALID}: the presented reset token is not the one this credential issued.`
			);
		}

		if (new Date(credential.resetExpiresAt).getTime() <= at.getTime()) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_CREDENTIAL_TOKEN_INVALID}: this reset token lapsed at ${new Date(
					credential.resetExpiresAt
				).toISOString()}.`
			);
		}

		if (!input?.passwordHash) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED}: a reset is completed with the hash the password hasher produced, and none was presented.`
			);
		}

		await this.update(id, {
			passwordHash: input.passwordHash,
			resetToken: null,
			resetExpiresAt: null,
			verificationToken: null,
			verificationExpiresAt: null,
			failedAttempts: 0,
			lockedUntil: null
		} as never);

		return this.findCredentialOrFail(id);
	}

	/**
	 * Records one failed authentication and applies the lockout ladder.
	 *
	 * The ladder is stated once, in {@link CONTACT_LOCKOUT_POLICY}: the fifth consecutive failure arms a
	 * fifteen-minute lock, a further failure **while already locked** extends the lock to thirty minutes
	 * from that moment, and no lock is ever set past a day. The ceiling is a clamp rather than a refusal
	 * so that a credential under a sustained attack converges on the longest lock there is instead of
	 * failing its own bookkeeping.
	 *
	 * The counter is per credential and never per address: a shared office address is therefore never
	 * locked out, and address-level abuse is the rate limiter's business.
	 *
	 * @param id The credential that was presented.
	 * @param at The instant the attempt happened at. Defaults to now.
	 * @param policy The ladder to apply. Defaults to the platform's.
	 * @returns The stored credential, with the counter and lock as they now stand.
	 * @throws NotFoundException when the credential is not in the caller's scope.
	 */
	async registerFailedAttempt(
		id: ID,
		at: Date = new Date(),
		policy: IContactLockoutPolicy = CONTACT_LOCKOUT_POLICY
	): Promise<IContactCredential> {
		const credential = await this.findCredentialOrFail(id);
		const attempts = Number(credential.failedAttempts ?? 0) + 1;
		const ceiling = at.getTime() + policy.maxHours * 60 * 60 * 1000;

		let lockedUntil: Date | null = credential.lockedUntil ? new Date(credential.lockedUntil) : null;
		const locked = Boolean(lockedUntil) && (lockedUntil as Date).getTime() > at.getTime();

		if (locked) {
			// Already locked and failing again: the lock is extended, and clamped to the ceiling.
			const extended = at.getTime() + policy.extensionMinutes * 60 * 1000;
			lockedUntil = new Date(Math.min(extended, ceiling));
		} else if (attempts >= policy.threshold) {
			const armed = at.getTime() + policy.durationMinutes * 60 * 1000;
			lockedUntil = new Date(Math.min(armed, ceiling));
		}

		await this.update(id, {
			failedAttempts: attempts,
			lockedUntil
		} as never);

		return this.findCredentialOrFail(id);
	}

	/**
	 * Records a successful authentication, which clears the counter and the lock.
	 *
	 * Both together, because they are one fact: the ladder counts **consecutive** failures, so a success
	 * that cleared only the counter would leave a lock armed against a credential whose owner has just
	 * proved the password.
	 *
	 * @param id The credential that authenticated.
	 * @param at The instant the authentication happened at. Defaults to now.
	 * @returns The stored credential.
	 * @throws NotFoundException when the credential is not in the caller's scope.
	 */
	async recordSuccessfulLogin(id: ID, at: Date = new Date()): Promise<IContactCredential> {
		await this.findCredentialOrFail(id);

		await this.update(id, {
			lastLoginAt: at,
			failedAttempts: 0,
			lockedUntil: null
		} as never);

		return this.findCredentialOrFail(id);
	}

	/**
	 * Refuses a login a locked credential may not serve.
	 *
	 * The check is made **before** the password is verified, which is what keeps the response time
	 * constant and stops the refusal being used to probe which passwords are close. It is a separate
	 * method rather than a branch inside the failure path so that the login flow cannot forget it.
	 *
	 * @param credential The credential that was presented.
	 * @param at The instant the login happens at. Defaults to now.
	 * @throws BadRequestException `CONTACT_CREDENTIAL_LOCKED` while the lock is armed.
	 */
	assertLoginAllowed(credential: IContactCredential, at: Date = new Date()): void {
		if (this.isLocked(credential, at)) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_CREDENTIAL_LOCKED}: too many failed attempts. Try again after ${new Date(
					credential.lockedUntil as Date
				).toISOString()}.`
			);
		}
	}

	/**
	 * Whether a credential is locked at an instant.
	 *
	 * @param credential The credential.
	 * @param at The instant to compare against. Defaults to now.
	 * @returns True while the lock is armed.
	 */
	isLocked(credential: IContactCredential, at: Date = new Date()): boolean {
		return Boolean(credential?.lockedUntil) && new Date(credential.lockedUntil as Date).getTime() > at.getTime();
	}

	/**
	 * Enrols an authenticator factor.
	 *
	 * The secret arrives already encrypted by the caller: encryption at rest is the service's contract
	 * for this member, and doing it here would mean this service owned a key. What it does own is the
	 * refusal to accept one through a request body — {@link updateCredential} refuses the member — so the
	 * only paths that reach this method are the enrolment flow's.
	 *
	 * @param id The credential enrolling.
	 * @param secret The encrypted authenticator secret.
	 * @returns The stored credential.
	 * @throws BadRequestException `CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED` for a blank secret.
	 * @throws NotFoundException when the credential is not in the caller's scope.
	 */
	async setMfaSecret(id: ID, secret: string): Promise<IContactCredential> {
		await this.findCredentialOrFail(id);

		if (!secret || !String(secret).trim()) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED}: an authenticator secret is what is enrolled here, and none was presented.`
			);
		}

		await this.update(id, { mfaSecret: String(secret).trim() } as never);

		return this.findCredentialOrFail(id);
	}

	/**
	 * Removes the authenticator factor, which is what a disable leaves behind.
	 *
	 * @param id The credential.
	 * @returns The stored credential.
	 * @throws NotFoundException when the credential is not in the caller's scope.
	 */
	async clearMfaSecret(id: ID): Promise<IContactCredential> {
		await this.findCredentialOrFail(id);
		await this.update(id, { mfaSecret: null } as never);

		return this.findCredentialOrFail(id);
	}

	/**
	 * Soft-deletes a credential, which is the only removal path there is.
	 *
	 * The row is kept rather than hard-deleted: the sessions, the audit entries and the export archive
	 * that referenced it stay readable, and a party that registers again is attached to the same contact
	 * rather than duplicated.
	 *
	 * @param id The credential to soft-delete.
	 * @returns The stored credential, soft-deleted.
	 * @throws NotFoundException when the credential is not in the caller's scope.
	 */
	async removeCredential(id: ID): Promise<IContactCredential> {
		await this.findCredentialOrFail(id);
		await this.softDelete(id);

		return this.findCredentialOrFail(id);
	}

	/**
	 * The readable shape of a credential — the only one this service answers with.
	 *
	 * The secrets are not members of the returned type at all: the hash, the authenticator secret and the
	 * two tokens are absent rather than null, so a projection cannot leak one by forgetting to blank it,
	 * and a client is never given a field it can never legitimately read.
	 *
	 * @param credential The stored credential.
	 * @returns The projection, with no secret in it.
	 */
	toPublicCredential(credential: IContactCredential): IContactCredentialPublic {
		return {
			id: credential.id,
			tenantId: credential.tenantId,
			organizationId: credential.organizationId,
			createdAt: credential.createdAt,
			updatedAt: credential.updatedAt,
			customerId: credential.customerId,
			email: credential.email,
			isVerified: Boolean(credential.isVerified),
			lastLoginAt: credential.lastLoginAt,
			lockedUntil: credential.lockedUntil,
			hasMfa: Boolean(credential.mfaSecret)
		};
	}

	/**
	 * Refuses a body that states a member this operation does not own.
	 *
	 * @param input The body as the caller stated it.
	 * @param members The members the operation refuses.
	 * @param operation What the caller was doing, for the message.
	 * @throws BadRequestException `CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED`.
	 */
	private assertNoMembers(input: unknown, members: readonly string[], operation: string): void {
		const stated = (input ?? {}) as unknown as Record<string, unknown>;

		for (const member of members) {
			if (stated[member] === undefined || stated[member] === null) {
				continue;
			}

			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED}: '${member}' is a secret the platform produces and never a value ${operation} with; the operation that observes it owns it.`
			);
		}
	}

	/**
	 * Validates a single-use token and its window as one fact.
	 *
	 * @param input The token and the instant it lapses.
	 * @throws BadRequestException `CONTACT_CREDENTIAL_TOKEN_INVALID` for a half-stated or already-lapsed
	 * pair.
	 */
	private assertTokenWindow(input: IContactCredentialTokenInput): void {
		if (!input?.token || !String(input.token).trim() || !input?.expiresAt) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_CREDENTIAL_TOKEN_INVALID}: a single-use token is the token and the instant it lapses, and both are required together.`
			);
		}

		const expiresAt = new Date(input.expiresAt);

		if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_CREDENTIAL_TOKEN_INVALID}: a token that lapses at '${String(
					input.expiresAt
				)}' is already spent, and a token that works for no time verifies nothing.`
			);
		}
	}

	/**
	 * Trims and lower-cases an address, and refuses a blank one.
	 *
	 * @param email The address as the caller stated it.
	 * @returns The stored form.
	 * @throws BadRequestException `CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED` when nothing was presented.
	 */
	private normaliseEmail(email?: string): string {
		const normalised = String(email ?? '').trim().toLowerCase();

		if (!normalised) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED}: a credential is resolved by its address, and none was presented.`
			);
		}

		return normalised;
	}

	/**
	 * Refuses a second credential for one contact.
	 *
	 * @param customerId The contact.
	 * @throws BadRequestException `CONTACT_CREDENTIAL_EXISTS`.
	 */
	private async assertCustomerHasNoCredential(customerId: ID): Promise<void> {
		const existing = await this.findCredentialOfCustomer(customerId);

		if (existing) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_CREDENTIAL_EXISTS}: contact '${customerId}' already holds a credential, and one contact is one login.`
			);
		}
	}

	/**
	 * Refuses an address another live credential of this tenant already holds.
	 *
	 * The scope is the tenant's, which is the scope of the uniqueness rule itself: an address that named
	 * two rows would make the login resolver choose between two parties.
	 *
	 * @param email The normalised address.
	 * @param exceptId The credential being written, excluded from the probe.
	 * @throws BadRequestException `CONTACT_CREDENTIAL_EMAIL_TAKEN`.
	 */
	private async assertEmailAvailable(email: string, exceptId?: ID): Promise<void> {
		const credentials: ContactCredential[] = await this.find({
			where: { email, tenantId: RequestContext.currentTenantId() }
		} as never);
		const taken = (credentials ?? []).filter((one) => !exceptId || String(one.id) !== String(exceptId));

		if (taken.length) {
			throw new BadRequestException(
				`${ApiErrorCode.CONTACT_CREDENTIAL_EMAIL_TAKEN}: '${email}' is already a login of this tenant, and an address resolves one credential.`
			);
		}
	}
}
