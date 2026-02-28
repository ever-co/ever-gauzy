import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PasswordHashService, User } from '@gauzy/core';
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
		private readonly passwordHashService: PasswordHashService
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
	 * @param email User email
	 * @param password User password (plain text)
	 * @returns Authenticated user info or null if authentication fails
	 */
	async authenticateMcpUser(email: string, password: string): Promise<IUser | null> {
		try {
			const user = await this.findUserWithRelations({ email });

			// If no user found, return null
			if (!user) {
				return null;
			}

			// Verify password using PasswordHashService
			if (!user.hash) {
				return null;
			}

			const isPasswordValid = await this.passwordHashService.verify(password, user.hash);
			if (!isPasswordValid) {
				return null;
			}

			return user;
		} catch (error) {
			this.logger.error('Error authenticating MCP user', (error as Error)?.stack || (error as Error)?.message);
			return null;
		}
	}

	/**
	 * Get user information by user ID for MCP OAuth
	 * Used by OAuth server to retrieve user details for token claims
	 *
	 * @param userId User ID
	 * @returns User information or null if not found
	 */
	async getMcpUserInfo(userId: string): Promise<IUser | null> {
		try {
			const user = await this.findUserWithRelations({ id: userId });

			return user || null;
		} catch (error) {
			this.logger.error('Error retrieving MCP user info', (error as Error)?.stack || (error as Error)?.message);
			return null;
		}
	}
}
