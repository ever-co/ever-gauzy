// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import {
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnauthorizedException
} from '@nestjs/common';
import {
	InsertResult,
	SelectQueryBuilder,
	Brackets,
	WhereExpressionBuilder,
	In,
	UpdateResult,
	DeleteResult
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from 'jsonwebtoken';
import { ComponentLayoutStyleEnum, IEmployee, IFindMeUser, IUser, LanguagesEnum, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
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

		// If 'includeEmployee' is set to true, fetch employee details associated with the user.
		if (options.includeEmployee) {
			const relations: any = {};

			// Include organization relation if 'includeOrganization' is true
			if (options.includeOrganization) {
				relations.organization = true;
			}

			employee = await this._employeeService.findOneByUserId(user.id, { relations });
		}

		// Return user data combined with employee data, if it exists.
		return {
			...user,
			...(employee && { employee }) // Conditionally add employee info to the response
		};
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
				return await this.mikroOrmRepository.nativeUpdate({ id }, {
					emailVerifiedAt: freshTimestamp(),
					emailToken: null,
					code: null,
					codeExpireAt: null
				})
			case MultiORMEnum.TypeORM:
				return await this.typeOrmRepository.update({ id }, {
					emailVerifiedAt: freshTimestamp(),
					emailToken: null,
					code: null,
					codeExpireAt: null
				});
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

	async changePassword(id: string, hash: string) {
		try {
			const user = await this.findOneByIdString(id);
			user.hash = hash;
			return await this.typeOrmRepository.save(user);
		} catch (error) {
			throw new ForbiddenException();
		}
	}

	/*
	 * Update user profile
	 */
	async updateProfile(id: string | number, entity: User): Promise<IUser> {
		/**
		 * If user has only own profile edit permission
		 */
		if (
			RequestContext.hasPermission(PermissionsEnum.PROFILE_EDIT) &&
			!RequestContext.hasPermission(PermissionsEnum.ORG_USERS_EDIT)
		) {
			if (RequestContext.currentUserId() !== id) {
				throw new ForbiddenException();
			}
		}
		let user: IUser;
		try {
			if (typeof id == 'string') {
				user = await this.findOneByIdString(id, {
					relations: {
						role: true
					}
				});
			}
			/**
			 * If user try to update Super Admin without permission
			 */
			if (user.role.name === RolesEnum.SUPER_ADMIN) {
				if (!RequestContext.hasPermission(PermissionsEnum.SUPER_ADMIN_EDIT)) {
					throw new ForbiddenException();
				}
			}
			if (entity['hash']) {
				entity['hash'] = await this.getPasswordHash(entity['hash']);
			}

			await this.save(entity);
			try {
				return await this.findOneByWhereOptions({
					id: id as string,
					tenantId: RequestContext.currentTenantId()
				});
			} catch { }
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
	 *
	 * @param password
	 * @returns
	 */
	private async getPasswordHash(password: string): Promise<string> {
		return bcrypt.hash(password, env.USER_PASSWORD_BCRYPT_SALT_ROUNDS);
	}

	/**
	 * To permanently delete your account from your i4net app:
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
			if (employee) { await this._taskService.unassignEmployeeFromTeamTasks(employee.id); }

			return await super.delete(userId);
		} catch (error) {
			throw new ForbiddenException(error?.message);
		}
	}
}
