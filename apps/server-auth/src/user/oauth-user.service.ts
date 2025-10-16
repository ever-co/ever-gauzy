import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '@gauzy/core';
import { IUser } from '@gauzy/contracts'

/**
 * OAuth User Service

 * It only implements the methods needed for MCP OAuth:
 * - authenticateMcpUser: Validate user credentials
 * - getMcpUserInfo: Get user information for token claims
 */
@Injectable()
export class OAuthUserService {
	constructor(
		@InjectRepository(User)
		private readonly typeOrmRepository: Repository<User>
	) {}

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
			// Find user by email from Gauzy DB
			const user = await this.typeOrmRepository.findOne({
				where: {
					email,
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

			// If no user found, return null
			if (!user) {
				return null;
			}

			// Verify password using bcrypt
			if (!user.hash) {
				return null;
			}

			const isPasswordValid = await bcrypt.compare(password, user.hash);
			if (!isPasswordValid) {
				return null;
			}

			return user;
		} catch (error) {
			logger.error('Error authenticating MCP user:', error as Error);
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
			// Find user by ID from Gauzy DB
			const user = await this.typeOrmRepository.findOne({
				where: {
					id: userId,
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

			return user || null;
		} catch (error) {
			logger.error('Error retrieving MCP user info:', error as Error);
			return null;
		}
	}
}
