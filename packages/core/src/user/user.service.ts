// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, InsertResult } from 'typeorm';
import { User } from './user.entity';
import { TenantAwareCrudService } from './../core/crud';

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
		const user = await this.findOne(id);
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
	): Promise<User> {
		try {
			const user = await this.findOne(id);
			if (!user) {
				throw new NotFoundException(`The user was not found`);
			}

			if (partialEntity['hash']) {
				const hashPassword = await this.getPasswordHash(
					partialEntity['hash']
				);
				partialEntity['hash'] = hashPassword;
			}

			return await this.repository.save(partialEntity);
		} catch (err) {
			throw new NotFoundException(`The record was not found`, err);
		}
	}
}
