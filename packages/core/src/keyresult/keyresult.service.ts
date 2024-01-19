import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KeyResult } from './keyresult.entity';
import { TenantAwareCrudService } from './../core/crud';

@Injectable()
export class KeyResultService extends TenantAwareCrudService<KeyResult> {
	constructor(
		@InjectRepository(KeyResult)
		private readonly keyResultRepository: Repository<KeyResult>,
		@MikroInjectRepository(KeyResult)
		private readonly mikroKeyResultRepository: EntityRepository<KeyResult>
	) {
		super(keyResultRepository, mikroKeyResultRepository);
	}

	async createBulk(input: KeyResult[]) {
		return await this.repository.save(input);
	}
}
