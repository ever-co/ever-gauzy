// cspell:ignore otpauth
import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	ServiceUnavailableException,
	UnauthorizedException
} from '@nestjs/common';
import { In, IsNull, LessThan, Not } from 'typeorm';
import { environment } from '@gauzy/config';
import {
	ID,
	ITwoFactorCodeInput,
	ITwoFactorConfirmation,
	ITwoFactorEnrollment,
	ITwoFactorRecoveryCodes,
	ITwoFactorStatus
} from '@gauzy/contracts';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { CrudService } from '../../core/crud/crud.service';
import { Organization } from '../../core/entities/internal';
import { isUniqueViolation } from '../../core/errors/unique-violation';
import { MultiORMEnum } from '../../core/utils';
import { LoginAttemptRule, LoginAttemptScope, LoginAttemptService } from '../login-attempt.service';
import { findRecoveryCodeHash, generateRecoveryCodes, hashRecoveryCode } from './recovery-codes';
import { MikroOrmUserTwoFactorRepository } from './repository/mikro-orm-user-two-factor.repository';
import { TypeOrmUserTwoFactorRepository } from './repository/type-orm-user-two-factor.repository';
import { buildOtpauthUrl, generateTotpSecret, matchingTimeStep } from './totp';
import { twoFactorSecretProblem, twoFactorSecretProblemMessage } from './two-factor-secret';
import { UserTwoFactor } from './user-two-factor.entity';

/** Wrong codes in a row after which the account's code checks are refused for a while: the next one is blocked. */
export const TWO_FACTOR_MAX_FAILED_CODES = 5;

/**
 * How code checks are counted. Reaching one already took the first factor (a password, an e-mail code or a signed-in
 * session), so failures from one client are enough to block, and the count does not follow the operator's switch for
 * passwords (`AUTH_MAX_FAILED_ATTEMPTS`). The block lasts `AUTH_LOCKOUT_SECONDS`.
 */
export const TWO_FACTOR_ATTEMPT_RULE: LoginAttemptRule = {
	maxFailures: TWO_FACTOR_MAX_FAILED_CODES,
	blockOnSingleSource: true
};

/** What a wrong code answers. */
export const TWO_FACTOR_WRONG_CODE_MESSAGE =
	'This code is not right. Type the current code of your authenticator app, or use a recovery code.';

/** What a check answers for an account without two-factor authentication. */
export const TWO_FACTOR_NOT_ENABLED_MESSAGE = 'Two-factor authentication is not on for this account.';

/** The user an enrolment is for, as the signed-in session knows them. */
export interface TwoFactorEnrollee {
	id: ID;
	tenantId: ID | null;
	email: string;
}

/**
 * Two-factor authentication with an authenticator app, for one user at a time (ever-co/ever-gauzy#11916).
 *
 * - **Enrolment.** A secret is drawn and kept encrypted (`EncryptionService`); the user confirms it with a first code,
 *   which turns it on and answers ten recovery codes, once. Only their SHA-256 is kept.
 * - **Checks.** A code is accepted for one 30-second step on each side of now, and each step once (replay); a recovery
 *   code once. Wrong proofs count per user (`TWO_FACTOR_ATTEMPT_RULE`): the sixth in a row is refused for a while.
 * - **Off.** The user turns it off with a proof; an administrator resets it, which is recorded on the row.
 *
 * Every method names its user: the sign-in checks run before any session exists, so nothing here reads the request
 * context. The routes decide who may act on whom.
 */
@Injectable()
export class UserTwoFactorService extends CrudService<UserTwoFactor> {
	private readonly logger = new Logger(UserTwoFactorService.name);

	constructor(
		readonly typeOrmUserTwoFactorRepository: TypeOrmUserTwoFactorRepository,
		readonly mikroOrmUserTwoFactorRepository: MikroOrmUserTwoFactorRepository,
		private readonly encryptionService: EncryptionService,
		private readonly loginAttemptService: LoginAttemptService
	) {
		super(typeOrmUserTwoFactorRepository, mikroOrmUserTwoFactorRepository);
	}

	/** Whether this server can keep authenticator secrets (it needs `ENCRYPTION_KEY`, see `two-factor-secret.ts`). */
	isAvailable(): boolean {
		return twoFactorSecretProblem() === null;
	}

	/**
	 * Whether the sign-ins of a user ask for a code.
	 *
	 * @param userId The user.
	 */
	async isEnabled(userId: ID): Promise<boolean> {
		const row = await this.findOfUser(userId);
		return Boolean(row?.enabledAt);
	}

	/**
	 * Which of these users have it on, in one read.
	 *
	 * @param userIds The users.
	 */
	async enabledAmong(userIds: readonly ID[]): Promise<Set<ID>> {
		const ids = [...new Set(userIds.filter(Boolean))];
		if (ids.length === 0) {
			return new Set();
		}
		const where = { userId: In(ids), enabledAt: Not(IsNull()) };
		const rows = await this.find({ where, select: { id: true, userId: true } });
		return new Set(rows.map((row) => row.userId));
	}

	/**
	 * Whether an organization asks its members to turn two-factor authentication on (`organization.requireTwoFactor`).
	 *
	 * @param organizationId The organization.
	 * @param tenantId Its tenant: an organization of another tenant answers false.
	 */
	async isRequiredByOrganization(
		organizationId: ID | null | undefined,
		tenantId: ID | null | undefined
	): Promise<boolean> {
		const hasScope = Boolean(organizationId) && Boolean(tenantId);
		if (!hasScope) {
			return false;
		}
		let organization: Pick<Organization, 'requireTwoFactor'> | null;
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				organization = await this.mikroOrmUserTwoFactorRepository
					.getEntityManager()
					.findOne(Organization, { id: organizationId, tenantId }, { fields: ['id', 'requireTwoFactor'] });
				break;
			case MultiORMEnum.TypeORM:
				organization = await this.typeOrmUserTwoFactorRepository.manager.findOne(Organization, {
					where: { id: organizationId, tenantId },
					select: { id: true, requireTwoFactor: true }
				});
				break;
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
		return organization?.requireTwoFactor === true;
	}

	/**
	 * Whether a sign-in must ask the member to set it up: their organization requires it and they have not turned it on.
	 *
	 * @param userId The member.
	 * @param organizationId The organization of the session.
	 * @param tenantId Its tenant.
	 */
	async isSetupRequired(
		userId: ID,
		organizationId: ID | null | undefined,
		tenantId: ID | null | undefined
	): Promise<boolean> {
		const isRequired = await this.isRequiredByOrganization(organizationId, tenantId);
		if (!isRequired) {
			return false;
		}
		const isEnabled = await this.isEnabled(userId);
		return !isEnabled;
	}

	/**
	 * A user's state, as their settings show it.
	 *
	 * @param userId The user.
	 * @param requiredByOrganization Whether the organization of their session asks for it.
	 */
	async statusOf(userId: ID, requiredByOrganization: boolean): Promise<ITwoFactorStatus> {
		const row = await this.findOfUser(userId);
		const enabledAt = row?.enabledAt ?? null;
		const isEnabled = Boolean(enabledAt);
		const hasSecret = Boolean(row?.secret);
		const pendingEnrollment = hasSecret && !isEnabled;
		let recoveryCodesLeft = 0;
		if (isEnabled) {
			recoveryCodesLeft = this.recoveryHashesOf(row).length;
		}
		return {
			available: this.isAvailable(),
			enabled: isEnabled,
			enabledAt,
			pendingEnrollment,
			recoveryCodesLeft,
			requiredByOrganization
		};
	}

	/**
	 * Starts (or restarts) an enrolment: draws a secret, keeps it encrypted, and answers it with its `otpauth://`
	 * address for the QR code. Nothing changes for the sign-ins until a first code confirms it.
	 *
	 * @param user The signed-in user.
	 * @param issuer The name the authenticator app shows; the API's own name by default.
	 * @throws ServiceUnavailableException when this server cannot keep secrets.
	 * @throws ConflictException when it is already on.
	 */
	async enroll(user: TwoFactorEnrollee, issuer?: string): Promise<ITwoFactorEnrollment> {
		this.assertAvailable();

		const row = await this.findOfUser(user.id);
		if (row?.enabledAt) {
			throw new ConflictException(
				'Two-factor authentication is already on. Turn it off before setting up another app.'
			);
		}

		const secret = generateTotpSecret();
		const sealed = this.encryptionService.encrypt(secret);
		const pending = { secret: sealed, enabledAt: null, recoveryCodes: null, lastUsedTimeStep: 0 };
		if (row) {
			await this.update({ id: row.id, enabledAt: IsNull() }, pending);
		} else {
			await this.insertOrUpdatePending(user, pending);
		}

		const name = issuer?.trim() || environment.appIntegrationConfig.appName;
		return { secret, otpauthUrl: buildOtpauthUrl({ secret, accountName: user.email, issuer: name }) };
	}

	/**
	 * Confirms an enrolment with the first code of the app, which turns two-factor authentication on, and answers the
	 * recovery codes (shown once: only their hashes are kept).
	 *
	 * @param userId The signed-in user.
	 * @param code The first code.
	 * @throws BadRequestException when no enrolment waits for a code.
	 * @throws UnauthorizedException for a wrong code; HttpException 429 after too many.
	 */
	async confirm(userId: ID, code: string): Promise<ITwoFactorConfirmation> {
		const row = await this.findOfUser(userId);
		const isPending = Boolean(row?.secret) && !row?.enabledAt;
		if (!isPending) {
			throw new BadRequestException(
				'There is no authenticator waiting for its first code: start the setup again.'
			);
		}

		const step = await this.checkCounted(userId, () => this.acceptCode(row, code));

		const recoveryCodes = generateRecoveryCodes();
		const enabledAt = new Date();
		// Only the secret the code was checked against: an enrolment started again meanwhile replaced it, and turning that
		// one on would enable a secret nobody proved.
		const turnedOn = await this.update(
			{ id: row.id, enabledAt: IsNull(), secret: row.secret },
			{ enabledAt, recoveryCodes: this.serializeHashes(recoveryCodes), lastUsedTimeStep: step }
		);
		if (!this.changedOne(turnedOn)) {
			throw new ConflictException(
				'The setup was started again or finished meanwhile: start it again and confirm with the new code.'
			);
		}
		return { enabledAt, recoveryCodes };
	}

	/**
	 * Checks the second factor of a user who has it on: a current code (each step once) or a recovery code (used up).
	 *
	 * @param userId The user.
	 * @param proof The code or the recovery code.
	 * @throws UnauthorizedException for a wrong proof, or when it is not on; HttpException 429 after too many.
	 */
	async verifySecondFactor(userId: ID, proof: ITwoFactorCodeInput): Promise<void> {
		await this.checkCounted(userId, async () => {
			const row = await this.findOfUser(userId);
			if (!row?.enabledAt) {
				throw new UnauthorizedException(TWO_FACTOR_NOT_ENABLED_MESSAGE);
			}
			const hasRecoveryCode = Boolean(proof?.recoveryCode?.trim());
			if (hasRecoveryCode) {
				return await this.useRecoveryCode(row, proof.recoveryCode);
			}
			return await this.acceptCode(row, proof?.code);
		});
	}

	/**
	 * Turns it off, after a proof: the secret and the recovery codes are dropped.
	 *
	 * @param userId The signed-in user.
	 * @param proof A current code or a recovery code.
	 */
	async disable(userId: ID, proof: ITwoFactorCodeInput): Promise<void> {
		await this.verifySecondFactor(userId, proof);
		await this.update({ userId }, { enabledAt: null, secret: null, recoveryCodes: null, lastUsedTimeStep: 0 });
	}

	/**
	 * Replaces the recovery codes, after a proof. The old ones stop working.
	 *
	 * @param userId The signed-in user.
	 * @param proof A current code or a recovery code.
	 */
	async regenerateRecoveryCodes(userId: ID, proof: ITwoFactorCodeInput): Promise<ITwoFactorRecoveryCodes> {
		await this.verifySecondFactor(userId, proof);
		const recoveryCodes = generateRecoveryCodes();
		await this.update({ userId, enabledAt: Not(IsNull()) }, { recoveryCodes: this.serializeHashes(recoveryCodes) });
		return { recoveryCodes };
	}

	/**
	 * An administrator's reset, for a member who lost their phone and their recovery codes: it is turned off, and the
	 * reset is recorded on the row (when and by whom).
	 *
	 * @param userId The member.
	 * @param administratorId The administrator.
	 * @returns Whether there was something to reset.
	 */
	async resetByAdministrator(userId: ID, administratorId: ID): Promise<boolean> {
		const row = await this.findOfUser(userId);
		const hasSomethingToReset = Boolean(row?.enabledAt) || Boolean(row?.secret);
		if (!hasSomethingToReset) {
			return false;
		}
		await this.update(
			{ id: row.id },
			{
				enabledAt: null,
				secret: null,
				recoveryCodes: null,
				lastUsedTimeStep: 0,
				resetAt: new Date(),
				resetByUserId: administratorId
			}
		);
		this.logger.log(`Two-factor authentication of user ${userId} reset by administrator ${administratorId}`);
		return true;
	}

	/**
	 * Runs a check of a proof under the per-user count: a wrong proof counts, a right one clears the streak, and an
	 * error that says nothing about the proof leaves the count alone.
	 *
	 * @param userId The user.
	 * @param check Answers what the proof unlocked (a step, or true), or null when it is wrong.
	 */
	private async checkCounted<T>(userId: ID, check: () => Promise<T | null>): Promise<T> {
		const attempt = await this.loginAttemptService.begin(
			LoginAttemptScope.TWO_FACTOR_CODE,
			userId,
			undefined,
			TWO_FACTOR_ATTEMPT_RULE
		);
		let result: T | null;
		try {
			result = await check();
		} catch (error) {
			await attempt.release();
			throw error;
		}
		if (result === null) {
			await attempt.fail();
			throw new UnauthorizedException(TWO_FACTOR_WRONG_CODE_MESSAGE);
		}
		await attempt.succeed();
		return result;
	}

	/**
	 * Accepts a code of the app: the step it belongs to, which is stored so that the step cannot be used again, or null.
	 *
	 * @param row The user's row, with its secret.
	 * @param code What the person typed.
	 */
	private async acceptCode(row: UserTwoFactor, code: string | undefined): Promise<number | null> {
		const secret = this.openSecret(row);
		const step = matchingTimeStep(secret, code ?? '', Date.now());
		if (step === null) {
			return null;
		}
		// Only a step after the last accepted one, in one statement: two uses of a code at once cannot both pass.
		const stored = await this.update({ id: row.id, lastUsedTimeStep: LessThan(step) }, { lastUsedTimeStep: step });
		if (!this.changedOne(stored)) {
			return null;
		}
		return step;
	}

	/**
	 * Uses up a recovery code: true when it was unused, or null.
	 *
	 * @param row The user's row, with its recovery codes.
	 * @param input What the person typed.
	 */
	private async useRecoveryCode(row: UserTwoFactor, input: string): Promise<true | null> {
		const hashes = this.recoveryHashesOf(row);
		const found = findRecoveryCodeHash(hashes, input);
		if (!found) {
			return null;
		}
		const remaining = hashes.filter((hash) => hash !== found);
		// Written only over the list that was read, so the same code used twice at once passes once.
		const stored = await this.update(
			{ id: row.id, recoveryCodes: row.recoveryCodes },
			{ recoveryCodes: JSON.stringify(remaining) }
		);
		if (!this.changedOne(stored)) {
			return null;
		}
		return true;
	}

	/** The row of a user, read with its secret columns (the serialized reads of `CrudService` leave them out). */
	private async findOfUser(userId: ID): Promise<UserTwoFactor | null> {
		if (!userId) {
			return null;
		}
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return (await this.mikroOrmUserTwoFactorRepository.findOne({ userId })) ?? null;
			case MultiORMEnum.TypeORM:
				return (await this.typeOrmUserTwoFactorRepository.findOne({ where: { userId } })) ?? null;
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}

	/** Creates the pending row of a first enrolment; a concurrent first enrolment's row is updated instead. */
	private async insertOrUpdatePending(user: TwoFactorEnrollee, pending: Partial<UserTwoFactor>): Promise<void> {
		try {
			await this.create({ tenantId: user.tenantId, userId: user.id, ...pending });
		} catch (error) {
			if (!isUniqueViolation(error) && !isUniqueViolation(error?.cause)) {
				throw error;
			}
			await this.update({ userId: user.id, enabledAt: IsNull() }, pending);
		}
	}

	/** The decrypted secret of a row. */
	private openSecret(row: UserTwoFactor): string {
		try {
			return this.encryptionService.decrypt(row.secret);
		} catch (error) {
			this.logger.error(`The authenticator secret of user ${row.userId} cannot be decrypted: ${error?.message}`);
			throw new ServiceUnavailableException(
				'The authenticator secret of this account cannot be read on this server. Use a recovery code.'
			);
		}
	}

	/** The hashes of the unused recovery codes of a row. */
	private recoveryHashesOf(row: UserTwoFactor | null): string[] {
		if (!row?.recoveryCodes) {
			return [];
		}
		try {
			const parsed: unknown = JSON.parse(row.recoveryCodes);
			if (!Array.isArray(parsed)) {
				return [];
			}
			return parsed.filter((hash): hash is string => typeof hash === 'string');
		} catch {
			return [];
		}
	}

	/** The stored form of new recovery codes. */
	private serializeHashes(codes: readonly string[]): string {
		return JSON.stringify(codes.map(hashRecoveryCode));
	}

	/** Whether an update changed exactly one row. */
	private changedOne(result: unknown): boolean {
		const affected = (result as { affected?: number })?.affected;
		return affected === 1;
	}

	/** Refuses an enrolment on a server that cannot keep secrets, saying what the operator must set. */
	private assertAvailable(): void {
		const problem = twoFactorSecretProblem();
		if (problem) {
			throw new ServiceUnavailableException(twoFactorSecretProblemMessage(problem));
		}
	}
}
