// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, InsertResult, SelectQueryBuilder, Brackets, WhereExpressionBuilder, In, UpdateResult } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from 'jsonwebtoken';
import { ComponentLayoutStyleEnum, IUser, LanguagesEnum, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { environment as env } from '@gauzy/config';
import { User } from './user.entity';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { freshTimestamp } from 'core';

@Injectable()
export class UserService extends TenantAwareCrudService<User> {

	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>
	) {
		super(userRepository);
	}

	/**
	 * Marked email as verified for user
	 *
	 * @param id
	 * @returns
	 */
	public async markEmailAsVerified(id: IUser['id']) {
		return await this.userRepository.update({ id }, {
		  	emailVerifiedAt: freshTimestamp(),
			emailToken: null
		});
	}

	/**
	 * GET user by email in the same tenant
	 *
	 * @param email
	 * @returns
	 */
	async getUserByEmail(email: string): Promise<IUser | null> {
		return await this.repository.findOneBy({
			email
		});
	}

	/**
	 * GET user by email using social logins
	 *
	 * @param email
	 * @returns
	 */
	async getOAuthLoginEmail(email: string): Promise<IUser> {
		try {
			return await this.repository.findOneByOrFail({
				email
			});
		} catch (error) {
			throw new NotFoundException(`The requested record was not found`);
		}
	}

	/**
	 * Check if, email address exist
	 *
	 * @param email
	 * @returns
	 */
	async checkIfExistsEmail(email: string): Promise<boolean> {
		return !!(await this.repository.findOneBy({
			email
		}));
	}

	async checkIfExists(id: string): Promise<boolean> {
		return !!(await this.repository.findOneBy({
			id
		}));
	}

	async checkIfExistsThirdParty(thirdPartyId: string): Promise<boolean> {
		return !!(await this.repository.findOneBy({
			thirdPartyId
		}));
	}

	async getIfExists(id: string): Promise<User> {
		return await this.repository.findOneBy({
			id
		});
	}

	async getIfExistsThirdParty(thirdPartyId: string): Promise<User> {
		return await this.repository.findOneBy({
			thirdPartyId
		});
	}

	async createOne(user: User): Promise<InsertResult> {
		return await this.repository.insert(user);
	}

	async changePassword(id: string, hash: string) {
		try {
			const user = await this.findOneByIdString(id);
			user.hash = hash;
			return await this.repository.save(user);
		} catch (error) {
			throw new ForbiddenException();
		}
	}

	/*
	 * Update user profile
	 */
	async updateProfile(
		id: string | number,
		entity: User,
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
		try {
			if (typeof(id) == 'string') {
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
			} catch {}
		} catch (error) {
			throw new ForbiddenException();
		}
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
		});
	}

	/*
	 * Update user preferred language
	 */
	async updatePreferredLanguage(
		preferredLanguage: LanguagesEnum
	): Promise<IUser | UpdateResult> {
		try {
			return await this.update(RequestContext.currentUserId(), {
				preferredLanguage
			});
		} catch (err) {
			throw new NotFoundException(`The record was not found`, err);
		}
	}

	/*
	 * Update user preferred component layout
	 */
	async updatePreferredComponentLayout(
		preferredComponentLayout: ComponentLayoutStyleEnum
	): Promise<IUser | UpdateResult> {
		try {
			return await this.update(RequestContext.currentUserId(), {
				preferredComponentLayout
			});
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

			try {
				await this.repository.update({ id: userId, tenantId }, {
					refreshToken: null
				});
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
			const query = this.repository.createQueryBuilder('user');
			query.setFindOptions({
				join: {
					alias: 'user',
					leftJoin: {
						role: 'user.role'
					}
				}
			});
			query.where((query: SelectQueryBuilder<User>) => {
				query.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.andWhere(`"${query.alias}"."id" = :id`, { id });
						web.andWhere(`"${query.alias}"."email" = :email`, { email });
					})
				);
				query.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						if (isNotEmpty(tenantId)) {
							web.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
						}
						if (isNotEmpty(role)) {
							web.andWhere(`"role"."name" = :role`, { role });
						}
					})
				);
				query.orderBy(`"${query.alias}"."createdAt"`, 'DESC');
			});
			const user = await query.getOneOrFail();
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

	/**
	 * Find current loggin user details
	 *
	 * @param relations
	 * @returns
	 */
	public async findMe(relations: string[]): Promise<IUser> {
		return await this.findOneByIdString(RequestContext.currentUserId(), {
			relations
		})
	}
}
