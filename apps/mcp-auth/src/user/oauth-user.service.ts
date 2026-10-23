import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginAttemptRequest, LoginAttemptScope, LoginAttemptService, PasswordHashService, User } from '@gauzy/core';
import { IUser } from '@gauzy/contracts';

/**
 * OAuth User Service

 * It only implements the methods needed for MCP OAuth:
 * - authenticateMcpUser: Validate user credentials
 * - getMcpUserInfo: Get user information for token claims
 */
@Injectable()
export class OAuthUserService {
	private readonly logger = new Logger(OAuthUserService.name);

	constructor(
		@InjectRepository(User)
		private readonly typeOrmRepository: Repository<User>,
		private readonly passwordHashService: PasswordHashService,
		private readonly loginAttemptService: LoginAttemptService
	) {}

	/**
	 * Find user by email or ID with required relations
	 */
	private async findUserWithRelations(where: { email: string } | { id: string }): Promise<User | null> {
		return this.typeOrmRepository.findOne({
			where: {
				...where,
				isActive: true,
				isArchived: false
			},
			relations: {
				role: true,
				tenant: true,
				organizations: {
					organization: true
				}
			}
		});
	}

	/**
	 * Authenticate user with email and password for MCP OAuth
	 * Validates credentials against Gauzy database
	 *
	 * Failures count against the account in the same per-account counter the Gauzy API's own login uses
	 * (`AUTH_MAX_FAILED_ATTEMPTS` failures from more than one address block it for `AUTH_LOCKOUT_SECONDS`), so this
	 * form gives a guesser no more attempts than `POST /api/auth/login` does. It used to have no counter at all: only
	 * the per-address rate limit, which a guesser spreading attempts over many addresses never meets.
	 *
	 * @param email User email
	 * @param password User password (plain text)
	 * @param request The login form submission, to attribute the attempt to its client
	 * @returns Authenticated user info or null if authentication fails
	 * @throws HttpException 429 while the account is blocked: no password is checked then
	 */
	async authenticateMcpUser(email: string, password: string, request?: LoginAttemptRequest): Promise<IUser | null> {
		// Outside the try below, which answers every failure with null: a blocked account must surface as a 429.
		const attempt = await this.loginAttemptService.begin(LoginAttemptScope.PASSWORD, email, request);

		try {
			const user = await this.findUserWithRelations({ email });

			// If no user found, return null
			if (!user) {
				await attempt.fail();
				return null;
			}

			// Verify password using PasswordHashService
			if (!user.hash) {
				await attempt.fail();
				return null;
			}

			const isPasswordValid = await this.passwordHashService.verify(password, user.hash);
			if (!isPasswordValid) {
				await attempt.fail();
				return null;
			}

			await attempt.succeed();
			return user;
		} catch (error) {
			// A database or hashing error says nothing about the password: it does not count against the account.
			await attempt.release();
			this.logger.error('Error authenticating MCP user', (error as Error)?.stack || (error as Error)?.message);
			return null;
		}
	}

	/**
	 * Get user information by user ID for MCP OAuth
	 * Used by OAuth server to retrieve user details for token claims, and to re-check the account on
	 * every `refresh_token` grant (GHSA-3cgp-wmrg-4fqg).
	 *
	 * `null` therefore means exactly one thing: no user with that id can sign in any more — the row
	 * is gone, deactivated or archived. A lookup that could not be PERFORMED (database down, timeout)
	 * is re-thrown rather than flattened into `null`, because the refresh grant answers `null` with
	 * `invalid_grant`, which tells the client to discard a refresh token that is in fact still valid.
	 * The callers turn the rejection into a retryable 503/500 instead.
	 *
	 * @param userId User ID
	 * @returns User information, or null when no active user has that id
	 * @throws The underlying error when the lookup itself fails
	 */
	async getMcpUserInfo(userId: string): Promise<IUser | null> {
		try {
			const user = await this.findUserWithRelations({ id: userId });

			return user || null;
		} catch (error) {
			this.logger.error('Error retrieving MCP user info', (error as Error)?.stack || (error as Error)?.message);
			throw error;
		}
	}
}
