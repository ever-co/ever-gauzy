// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import {
	InsertResult,
	SelectQueryBuilder,
	Brackets,
	WhereExpressionBuilder,
	In,
	UpdateResult,
	DeleteResult,
	MoreThan
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from 'jsonwebtoken';
import * as moment from 'moment';
import {
	ComponentLayoutStyleEnum,
	ID,
	IEmployee,
	IFindMeUser,
	IUser,
	LanguagesEnum,
	PermissionsEnum,
	RolesEnum,
	UserStats
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { ConfigService, environment as env } from '@gauzy/config';
import { prepareSQLQuery as p } from './../database/database.helper';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { freshTimestamp, MultiORMEnum } from './../core/utils';
import { EmployeeService } from '../employee/employee.service';
import { TaskService } from '../tasks/task.service';
import { MikroOrmUserRepository, TypeOrmUserRepository } from './repository';
import { User } from './user.entity';

@Injectable()
export class UserService extends TenantAwareCrudService<User> {
	constructor(
		readonly typeOrmUserRepository: TypeOrmUserRepository,
		readonly mikroOrmUserRepository: MikroOrmUserRepository,
		private readonly _configService: ConfigService,
		private readonly _employeeService: EmployeeService,
		private readonly _taskService: TaskService
	) {
		super(typeOrmUserRepository, mikroOrmUserRepository);
	}

	/**
	 * Get the count of users and the number of users who logged in during the last 30 days.
	 *
	 * @returns {Promise<UserStats>} - A promise that resolves to an object containing user statistics.
	 */
	async getUserStats(): Promise<UserStats> {
		try {
			const [count, lastMonthActiveUsers] = await Promise.all([
				this.count(), // Get the total number of users
				this.getMonthlyActiveUsers() // Get the number of users active in the last 30 days
			]);

			return {
				count, // The total number of users
				lastMonthActiveUsers // The number of active users in the last month
			};
		} catch (error) {
			console.error('Error fetching user stats:', error);
			throw new Error(`Failed to retrieve user statistics: ${error.message}`);
		}
	}

	/**
	 * Get the count of users who logged in during the last 30 days.
	 *
	 * @returns {Promise<number>} - The count of active users
	 */
	async getMonthlyActiveUsers(): Promise<number> {
		try {
			// Calculate the date 30 days ago
			const lastLoginAt = moment().subtract(30, 'days').toDate();

			// Use the count method to fetch the count of users with lastLoginAt within the last 30 days
			return await super.count({
				where: { lastLoginAt: MoreThan(lastLoginAt) }
			});
		} catch (error) {
			// Handle error, log it, or throw a custom exception
			console.error('Error fetching monthly active users:', error);
			throw new Error('Unable to retrieve monthly active users count.');
		}
	}

	/**
	 * Fetches the logged-in user's details along with associated employee details if requested.
	 *
	 * @param options Options for the findMeUser method.
	 * @returns A promise resolving to the user details.
	 */
	public async findMeUser(options: IFindMeUser): Promise<IUser> {
		let employee: IEmployee;

		// Check if there are relations to include and remove 'employee' from them if present.
		if (options.relations && options.relations.length > 0) {
			const index = options.relations.indexOf('employee');
			if (index > -1) {
				options.relations.splice(index, 1); // Removing 'employee' to handle it separately
			}
		}

		// Fetch the user along with requested relations (excluding employee).
		const user = await this.findMe(options.relations);

		console.log('findMe found User with Id:', user.id);

		// Fetch employee details if 'includeEmployee' is true
		if (options.includeEmployee) {
			const relations = options.includeOrganization ? { organization: true } : [];

			employee = await this._employeeService.findOneByUserId(user.id, { relations });
		}

		// Return user data combined with employee data, if it exists.
		return new User({
			...user,
			...(employee && { employee }) // Conditionally add employee info to the response
		});
	}

	/**
	 * Retrieves details of the currently logged-in user, including specified relations.
	 *
	 * @param relations An array of strings indicating which relations of the user to include.
	 * @returns A Promise resolving to the IUser object with the desired relations.
	 */
	private async findMe(relations: string[]): Promise<IUser> {
		try {
			// Get the current user's ID from the RequestContext
			const userId = RequestContext.currentUserId();
			// Fetch and return the user's details based on the provided relations
			return await this.findOneByIdString(userId, { relations });
		} catch (error) {
			// Log the error for debugging purposes
			console.error('Error in findMe:', error);
		}
	}

	/**
	 * Marked email as verified for user
	 *
	 * @param id
	 * @returns
	 */
	public async markEmailAsVerified(id: IUser['id']) {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return await this.mikroOrmRepository.nativeUpdate(
					{ id },
					{
						emailVerifiedAt: freshTimestamp(),
						emailToken: null,
						code: null,
						codeExpireAt: null
					}
				);
			case MultiORMEnum.TypeORM:
				return await this.typeOrmRepository.update(
					{ id },
					{
						emailVerifiedAt: freshTimestamp(),
						emailToken: null,
						code: null,
						codeExpireAt: null
					}
				);
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}

	/**
	 * GET user by email in the same tenant
	 *
	 * @param email
	 * @returns
	 */
	async getUserByEmail(email: string): Promise<IUser | null> {
		return await this.typeOrmRepository.findOneBy({ email });
	}

	/**
	 * GET user by email using social logins
	 *
	 * @param email
	 * @returns
	 */
	async getOAuthLoginEmail(email: string): Promise<IUser> {
		try {
			return await this.typeOrmRepository.findOneByOrFail({ email });
		} catch (error) {
			throw new NotFoundException(`The requested record was not found`);
		}
	}

	/**
	 * Checks if a user with the given email exists.
	 * @param {string} email - The email of the user to check.
	 * @returns {Promise<boolean>} - A promise that resolves to true if the user exists, otherwise false.
	 */
	async checkIfExistsEmail(email: string): Promise<boolean> {
		return !!(await this.typeOrmRepository.findOneBy({ email }));
	}

	/**
	 * Checks if a user with the given ID exists.
	 * @param {string} id - The ID of the user to check.
	 * @returns {Promise<boolean>} - A promise that resolves to true if the user exists, otherwise false.
	 */
	async checkIfExists(id: string): Promise<boolean> {
		return !!(await this.typeOrmRepository.findOneBy({ id }));
	}

	/**
	 * Checks if a user with the given third party ID exists.
	 * @param {string} thirdPartyId - The third party ID of the user to check.
	 * @returns {Promise<boolean>} - A promise that resolves to true if the user exists, otherwise false.
	 */
	async checkIfExistsThirdParty(thirdPartyId: string): Promise<boolean> {
		return !!(await this.typeOrmRepository.findOneBy({ thirdPartyId }));
	}

	/**
	 * Retrieves a user with the given ID if it exists.
	 * @param {string} id - The ID of the user to retrieve.
	 * @returns {Promise<User | undefined>} - A promise that resolves to the user if it exists, otherwise undefined.
	 */
	async getIfExists(id: string): Promise<User | undefined> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return await this.mikroOrmUserRepository.findOne({ id });

			case MultiORMEnum.TypeORM:
				return await this.typeOrmRepository.findOneBy({ id });
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}

	/**
	 * Retrieves a user with the given third party ID if it exists.
	 * @param {string} thirdPartyId - The third party ID of the user to retrieve.
	 * @returns {Promise<User | undefined>} - A promise that resolves to the user if it exists, otherwise undefined.
	 */
	async getIfExistsThirdParty(thirdPartyId: string): Promise<User | undefined> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return await this.mikroOrmUserRepository.findOne({ thirdPartyId });

			case MultiORMEnum.TypeORM:
				return await this.typeOrmRepository.findOneBy({ thirdPartyId });
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}

	/**
	 * Creates a new user.
	 * @param {User} user - The user object to create.
	 * @returns {Promise<InsertResult>} - A promise that resolves to the insert result.
	 */
	async createOne(user: User): Promise<InsertResult> {
		return await this.typeOrmRepository.insert(user);
	}

	/**
	 * Updates the password for a user.
	 *
	 * @param id - The ID of the user whose password is to be changed.
	 * @param hash - The new hashed password to set for the user.
	 * @returns A promise resolving to the updated user entity.
	 * @throws ForbiddenException if the operation fails.
	 */
	async changePassword(id: ID, hash: string): Promise<User> {
		try {
			// Fetch the user by ID
			const user = await this.findOneByIdString(id);

			// Update the user's password hash
			user.hash = hash;

			// Save the updated user entity
			return await this.typeOrmRepository.save(user);
		} catch (error) {
			// Throw a ForbiddenException if any error occurs
			throw new ForbiddenException('Failed to update the password.');
		}
	}

	/**
	 * Updates the profile of a user.
	 * Ensures the user has the necessary permissions and applies restrictions to role updates.
	 *
	 * @param id - The ID of the user to update.
	 * @param entity - The user entity with updated data.
	 * @returns The updated user entity.
	 * @throws ForbiddenException if the user lacks the required permissions or attempts unauthorized updates.
	 */
	async updateProfile(id: ID | number, entity: User): Promise<IUser> {
		// Retrieve the current user's role ID from the RequestContext
		const currentRoleId = RequestContext.currentRoleId();
		const currentUserId = RequestContext.currentUserId();

		// Ensure the user has the appropriate permissions
		if (
			RequestContext.hasPermission(PermissionsEnum.PROFILE_EDIT) &&
			!RequestContext.hasPermission(PermissionsEnum.ORG_USERS_EDIT)
		) {
			// Users can only edit their own profile
			if (currentUserId !== id) {
				throw new ForbiddenException();
			}
		}

		let user: IUser;

		try {
			// Fetch the user by ID if the ID is a string
			if (typeof id == 'string') {
				user = await this.findOneByIdString(id, { relations: { role: true } });
			}

			// Restrict updates to Super Admin role without appropriate permission
			if (user.role.name === RolesEnum.SUPER_ADMIN) {
				if (!RequestContext.hasPermission(PermissionsEnum.SUPER_ADMIN_EDIT)) {
					throw new ForbiddenException();
				}
			}

			// Restrict updates to Super Admin role without appropriate permission
			if (user.role.name === RolesEnum.SUPER_ADMIN) {
				if (!RequestContext.hasPermission(PermissionsEnum.SUPER_ADMIN_EDIT)) {
					throw new ForbiddenException();
				}
			}

			// Restrict users from updating their own role

			if (currentUserId === id) {
				if (entity.role && entity.role.id !== currentRoleId) {
					throw new ForbiddenException();
				}
			}

			// Update password hash if provided
			if (entity['hash']) {
				entity['hash'] = await this.getPasswordHash(entity['hash']);
			}

			// Save the updated user entity
			await this.save(entity);

			// Return the updated user
			return await this.findOneByWhereOptions({
				id: id as string,
				tenantId: RequestContext.currentTenantId()
			});
		} catch (error) {
			throw new ForbiddenException();
		}
	}

	async getAdminUsers(tenantId: string): Promise<User[]> {
		return await this.typeOrmRepository.find({
			join: {
				alias: 'user',
				leftJoin: {
					role: 'user.role'
				}
			},
			where: {
				tenantId,
				role: {
					name: In([RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN])
				}
			}
		});
	}

	/**
	 * Updates the preferred language of the current user.
	 * @param {LanguagesEnum} preferredLanguage - The preferred language to update.
	 * @returns {Promise<IUser | UpdateResult>} - A promise that resolves to the updated user or update result.
	 */
	async updatePreferredLanguage(preferredLanguage: LanguagesEnum): Promise<IUser | UpdateResult> {
		try {
			const userId = RequestContext.currentUserId();
			return await this.update(userId, { preferredLanguage });
		} catch (err) {
			throw new NotFoundException(`The record was not found`, err);
		}
	}

	/**
	 * Updates the preferred component layout of the current user.
	 * @param {ComponentLayoutStyleEnum} preferredComponentLayout - The preferred component layout to update.
	 * @returns {Promise<IUser | UpdateResult>} - A promise that resolves to the updated user or update result.
	 */
	async updatePreferredComponentLayout(
		preferredComponentLayout: ComponentLayoutStyleEnum
	): Promise<IUser | UpdateResult> {
		try {
			const userId = RequestContext.currentUserId();
			return await this.update(userId, { preferredComponentLayout });
		} catch (err) {
			throw new NotFoundException(`The record was not found`, err);
		}
	}

	/**
	 * Sets the current refresh token for the user.
	 * @param {string} refreshToken - The refresh token to set.
	 * @param {string} userId - The ID of the user for whom to set the refresh token.
	 * @returns {Promise<void>} - A promise that resolves once the refresh token is set.
	 */
	async setCurrentRefreshToken(refreshToken: string, userId: string): Promise<UpdateResult> {
		try {
			// Hash the refresh token using bcrypt if refreshToken is provided
			if (refreshToken) {
				refreshToken = await bcrypt.hash(refreshToken, 10);
			}

			// Update the user's refresh token in the repository
			return await this.typeOrmRepository.update(userId, { refreshToken });
		} catch (error) {
			// Log error if any
			console.error('Error while setting current refresh token:', error);
		}
	}

	/**
	 * Removes the refresh token from the database.
	 * Logout Device
	 *
	 * @param userId
	 * @returns
	 */
	async removeRefreshToken() {
		try {
			const userId = RequestContext.currentUserId();
			const tenantId = RequestContext.currentTenantId();

			try {
				await this.typeOrmRepository.update(
					{ id: userId, tenantId },
					{
						refreshToken: null
					}
				);
			} catch (error) {
				console.log('Error while remove refresh token', error);
			}
		} catch (error) {
			console.log('Error while logout device', error);
		}
	}

	/**
	 * Update the last login time after user logged in
	 * @param {string} userId - The ID of the user for whom to set the last login time
	 * @return - A promise that resolves once the last login time is set
	 * @memberof UserService
	 */
	async setUserLastLoginTimestamp(userId: ID): Promise<UpdateResult> {
		try {
			const lastLoginAt = new Date(); // Define the last login time
			const id = userId; // Define the user ID

			// Update the last login time
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					const updatedRow = await this.mikroOrmRepository.nativeUpdate({ id }, { lastLoginAt });
					return { affected: updatedRow } as UpdateResult;
				case MultiORMEnum.TypeORM:
					return await this.typeOrmRepository.update({ id }, { lastLoginAt });
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
		} catch (error) {
			console.log('Error while updating last login time', error);
		}
	}

	/**
	 * Get user if refresh token matches
	 *
	 * @param refreshToken
	 * @param payload
	 * @returns
	 */
	async getUserIfRefreshTokenMatches(refreshToken: string, payload: JwtPayload) {
		try {
			const { id, email, tenantId, role } = payload;
			const query = this.typeOrmRepository.createQueryBuilder('user');
			query.setFindOptions({
				join: {
					alias: 'user',
					leftJoin: { role: 'user.role' }
				}
			});
			query.where((query: SelectQueryBuilder<User>) => {
				query.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.andWhere(p(`"${query.alias}"."id" = :id`), { id });
						web.andWhere(p(`"${query.alias}"."email" = :email`), { email });
					})
				);
				query.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						if (isNotEmpty(tenantId)) {
							web.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
						}
						if (isNotEmpty(role)) {
							web.andWhere(p(`"role"."name" = :role`), { role });
						}
					})
				);
				query.orderBy(p(`"${query.alias}"."createdAt"`), 'DESC');
			});
			const user = await query.getOneOrFail();
			const isRefreshTokenMatching = await bcrypt.compare(refreshToken, user.refreshToken);

			if (isRefreshTokenMatching) {
				return user;
			} else {
				throw new UnauthorizedException();
			}
		} catch (error) {
			throw new UnauthorizedException();
		}
	}

	/**
	 * Asynchronously generates a bcrypt hash from the provided password.
	 *
	 * @param password The password to hash.
	 * @returns A promise resolving to the bcrypt hash of the password.
	 */
	private async getPasswordHash(password: string): Promise<string> {
		try {
			// Generate bcrypt hash using provided password and salt rounds from environment
			return await bcrypt.hash(password, env.USER_PASSWORD_BCRYPT_SALT_ROUNDS);
		} catch (error) {
			// Handle any errors during hashing process
			console.error('Error generating password hash:', error);
		}
	}

	/**
	 * To permanently delete your account from your Gauzy app:
	 *
	 * @param userId
	 * @param options
	 * @returns
	 */
	public async delete(userId: IUser['id']): Promise<DeleteResult> {
		// Do not allow user to delete account in Demo server.
		if (!!this._configService.get('demo')) {
			throw new ForbiddenException('Do not allow user to delete account in Demo server');
		}

		const currentUserId = RequestContext.currentUserId();

		// If user don't have enough permission (CHANGE_SELECTED_EMPLOYEE).
		if (!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			// If user try to delete someone other user account, just denied the request.
			if (currentUserId != userId) {
				throw new ForbiddenException('You can not delete account for other users!');
			}
		}

		const user = await this.findOneByIdString(userId);

		if (!user) {
			throw new ForbiddenException('User not found for this ID!');
		}

		try {
			// TODO: Unassign all the task assigned to this user
			// Best to raise some event and handle it in the subscriber that remove tasks!
			const employee = await this._employeeService.findOneByUserId(user.id);
			if (employee) {
				await this._taskService.unassignEmployeeFromTeamTasks(employee.id);
			}

			return await super.delete(userId);
		} catch (error) {
			throw new ForbiddenException(error?.message);
		}
	}
}
