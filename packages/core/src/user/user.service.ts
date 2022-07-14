// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, InsertResult, SelectQueryBuilder, Brackets, WhereExpressionBuilder, FindManyOptions, In, FindOneOptions } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from 'jsonwebtoken';
import { ComponentLayoutStyleEnum, IUser, LanguagesEnum, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { environment as env } from '@gauzy/config';
import { User } from './user.entity';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';

@Injectable()
export class UserService extends TenantAwareCrudService<User> {
	constructor(
		@InjectRepository(User)
		userRepository: Repository<User>
	) {
		super(userRepository);
	}

	async getUserByEmail(email: string): Promise<User> {
		const user = await this.repository
			.createQueryBuilder('user')
			.where('user.email = :email', { email })
			.getOne();
		return user;
	}

	async getUserIdByEmail(email: string): Promise<string> {
		const user = await this.getUserByEmail(email);
		const userId = user.id;
		return userId;
	}

	async checkIfExistsEmail(email: string): Promise<boolean> {
		const count = await this.repository
			.createQueryBuilder('user')
			.where('user.email = :email', { email })
			.getCount();
		return count > 0;
	}

	async checkIfExists(id: string): Promise<boolean> {
		const count = await this.repository
			.createQueryBuilder('user')
			.where('user.id = :id', { id })
			.getCount();
		return count > 0;
	}

	async checkIfExistsThirdParty(thirdPartyId: string): Promise<boolean> {
		const count = await this.repository
			.createQueryBuilder('user')
			.where('user.thirdPartyId = :thirdPartyId', { thirdPartyId })
			.getCount();
		return count > 0;
	}

	async getIfExists(id: string): Promise<User> {
		return await this.repository
			.createQueryBuilder('user')
			.where('user.id = :id', { id })
			.getOne();
	}

	async getIfExistsThirdParty(thirdPartyId: string): Promise<User> {
		return await this.repository
			.createQueryBuilder('user')
			.where('user.thirdPartyId = :thirdPartyId', { thirdPartyId })
			.getOne();
	}

	async createOne(user: User): Promise<InsertResult> {
		return await this.repository.insert(user);
	}

	async changePassword(id: string, hash: string) {
		const user = await this.findOneByIdString(id);
		user.hash = hash;
		return await this.repository.save(user);
	}

	/*
	 * Update user profile
	 */
	async updateProfile(
		id: string | number,
		partialEntity: User,
		...options: any[]
	): Promise<IUser> {
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
		if (typeof(id) == 'string') {
			user = await this.findOneByIdString(id, {
				relations: ['role']
			});
		}
		if (!user) {
			throw new NotFoundException(`The user was not found`);
		}
		/**
		 * If user try to update Super Admin without permission
		 */
		if (user.role.name === RolesEnum.SUPER_ADMIN) {
			if (!RequestContext.hasPermission(PermissionsEnum.SUPER_ADMIN_EDIT)) {
				throw new ForbiddenException();
			}
		}

		if (partialEntity['hash']) {
			partialEntity['hash'] = await this.getPasswordHash(partialEntity['hash']);
		}

		return await this.repository.save(partialEntity);
	}

	async getAdminUsers(tenantId: string): Promise<User[]> {
		return await this.repository.find({
			join: {
				alias: 'user',
				leftJoin: {
					role: 'user.role'
				},
			},
			where: {
				tenantId,
				role: {
					name: In([
						RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN
					])
				}
			}
		} as FindManyOptions<User>);
	}

	/*
	 * Update user preferred language
	 */
	async updatePreferredLanguage(
		id: string | number,
		preferredLanguage: LanguagesEnum
	): Promise<IUser> {
		try {
			let user: User;
			if (typeof(id) == 'string') {
				user = await this.findOneByIdString(id);
			}
			if (!user) {
				throw new NotFoundException(`The user was not found`);
			}
			user.preferredLanguage = preferredLanguage;
			return await this.repository.save(user);
		} catch (err) {
			throw new NotFoundException(`The record was not found`, err);
		}
	}

	/*
	 * Update user preferred component layout
	 */
	async updatePreferredComponentLayout(
		id: string | number,
		preferredComponentLayout: ComponentLayoutStyleEnum
	): Promise<IUser> {
		try {

			let user: User;
			if (typeof(id) == 'string') {
				user = await this.findOneByIdString(id);
			}
			if (!user) {
				throw new NotFoundException(`The user was not found`);
			}
			user.preferredComponentLayout = preferredComponentLayout;
			return await this.repository.save(user);
		} catch (err) {
			throw new NotFoundException(`The record was not found`, err);
		}
	}

	/**
	 * Set Current Refresh Token
	 *
	 * @param refreshToken
	 * @param userId
	 */
	async setCurrentRefreshToken(refreshToken: string, userId: string) {
		try {
			if (refreshToken) {
				refreshToken = await bcrypt.hash(refreshToken, 10)
			}
			return await this.repository.update(userId, {
				refreshToken: refreshToken
			});
		} catch (error) {
			console.log('Error while set current refresh token', error);
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

			return await this.repository.update({ id: userId, tenantId }, {
				refreshToken: null
			});
		} catch (error) {
			console.log('Error while logout device', error);
		}
	}

	/**
	 * Get user if refresh token matches
	 *
	 * @param refreshToken
	 * @param userId
	 * @returns
	 */
	async getUserIfRefreshTokenMatches(refreshToken: string, payload: JwtPayload) {
		try {
			const { id, email, tenantId, role } = payload;
			const user = await this.repository.findOneOrFail({
				join: {
					alias: 'user',
					leftJoin: {
						role: 'user.role'
					}
				},
				where: (query: SelectQueryBuilder<User>) => {
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(`"${query.alias}"."id" = :id`, { id });
							qb.andWhere(`"${query.alias}"."email" = :email`, { email });
						})
					);
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							if (isNotEmpty(tenantId)) {
								qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
							}
							if (isNotEmpty(role)) {
								qb.andWhere(`"role"."name" = :role`, { role });
							}
						})
					);
				}
			} as FindOneOptions<User>);
			const isRefreshTokenMatching = await bcrypt.compare(refreshToken, user.refreshToken);
			if (isRefreshTokenMatching) {
				return user;
			} else {
				throw new UnauthorizedException()
			}
		} catch (error) {
			throw new UnauthorizedException();
		}
	}

	private async getPasswordHash(password: string): Promise<string> {
		return bcrypt.hash(password, env.USER_PASSWORD_BCRYPT_SALT_ROUNDS);
	}
}
