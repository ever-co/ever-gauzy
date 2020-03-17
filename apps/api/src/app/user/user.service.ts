// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, InsertResult } from 'typeorm';
import { User } from './user.entity';
import { CrudService } from '../core/crud/crud.service';

@Injectable()
export class UserService extends CrudService<User> {
	constructor(@InjectRepository(User) userRepository: Repository<User>) {
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
}
