import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Employee, PasswordHashService, User } from '@gauzy/core';
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
		@InjectRepository(Employee)
		private readonly typeOrmEmployeeRepository: Repository<Employee>
	) {}

	/**
	 * Find a user who can sign in, by email or ID, with required relations: an active, non-archived user
	 * who is not a deactivated employee (see {@link isDeactivatedEmployee}).
	 */
	private async findUserWithRelations(where: { email: string } | { id: string }): Promise<User | null> {
		const user = await this.typeOrmRepository.findOne({
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
		if (!user) {
			return null;
		}

		const employees = await this.typeOrmEmployeeRepository.find({
			where: { userId: user.id },
			select: { id: true, userId: true, isActive: true, isArchived: true }
		});
		return OAuthUserService.isDeactivatedEmployee(employees) ? null : user;
	}

	/**
	 * Whether a user's employee records make them a deactivated employee, who cannot sign in: they have
	 * employee records and none of them is active and unarchived. A user with no employee record (an
	 * admin, a viewer) is not one, and neither is an employee still active in another organization.
	 *
	 * @param employees The user's employee records.
	 */
	private static isDeactivatedEmployee(employees: Pick<Employee, 'isActive' | 'isArchived'>[]): boolean {
		return employees.length > 0 && !employees.some((employee) => employee.isActive && !employee.isArchived);
	}

	/**
	 * Names which of these users can no longer sign in: no active, non-archived user has that id, or the
	 * user is a deactivated employee. The MCP OAuth server revokes every token of each user named.
	 *
	 * @param userIds User IDs
	 * @returns The ids, among `userIds`, of users who can no longer sign in
	 * @throws The underlying error when the lookup itself fails, so nothing is revoked on a failed lookup
	 */
	async findUsersWhoCannotSignIn(userIds: string[]): Promise<string[]> {
		if (userIds.length === 0) {
			return [];
		}
		const users = await this.typeOrmRepository.find({
			where: { id: In(userIds), isActive: true, isArchived: false },
			select: { id: true }
		});
		const activeUserIds = users.map(({ id }) => id);

		const employees =
			activeUserIds.length > 0
				? await this.typeOrmEmployeeRepository.find({
						where: { userId: In(activeUserIds) },
						select: { id: true, userId: true, isActive: true, isArchived: true }
					})
				: [];
		const employeesByUser = new Map<string, Employee[]>();
		for (const employee of employees) {
			employeesByUser.set(employee.userId, [...(employeesByUser.get(employee.userId) ?? []), employee]);
		}

		const canSignIn = new Set(
			activeUserIds.filter((id) => !OAuthUserService.isDeactivatedEmployee(employeesByUser.get(id) ?? []))
		);
		return userIds.filter((id) => !canSignIn.has(id));
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
	 * Used by OAuth server to retrieve user details for token claims, and to re-check the account on
	 * every `refresh_token` grant (GHSA-3cgp-wmrg-4fqg).
	 *
	 * `null` therefore means exactly one thing: no user with that id can sign in any more — the row
	 * is gone, deactivated or archived, or the user is a deactivated employee. A lookup that could not be PERFORMED (database down, timeout)
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
