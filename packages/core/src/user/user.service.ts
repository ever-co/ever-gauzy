// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, InsertResult, SelectQueryBuilder } from 'typeorm';
import { User } from './user.entity';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { ComponentLayoutStyleEnum, IUser, LanguagesEnum, PermissionsEnum, RolesEnum } from '@gauzy/contracts';

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
		if (typeof(id) == 'number') {
			user = await this.findOneByIdNumber(id, {
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
		const roleNames =[RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN];		
		return await this.repository.find({
			join: {
				alias: 'user',
				leftJoin: {
					role: 'user.role'
				},
			},
			where: (qb: SelectQueryBuilder<User>) => {
					qb.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
						tenantId
					});
					qb.andWhere(`role.name IN (:...roleNames)`, {
						roleNames
					});
				}
			});		
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

			if (typeof(id) == 'number') {
				user = await this.findOneByIdNumber(id);
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

			if (typeof(id) == 'number') {
				user = await this.findOneByIdNumber(id);
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
}
