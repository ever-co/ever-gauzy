import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { KeyResult } from './keyresult.entity';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmKeyResultRepository } from './repository/type-orm-keyresult.repository';
import { MikroOrmKeyResultRepository } from './repository/mikro-orm-keyresult.repository';

@Injectable()
export class KeyResultService extends TenantAwareCrudService<KeyResult> {
	constructor(
		@InjectRepository(KeyResult)
		typeOrmKeyResultRepository: TypeOrmKeyResultRepository,

		mikroOrmKeyResultRepository: MikroOrmKeyResultRepository
	) {
		super(typeOrmKeyResultRepository, mikroOrmKeyResultRepository);
	}

	/**
	 *
	 * @param input
	 * @returns
	 */
	async createBulk(input: KeyResult[]) {
		return await this.typeOrmRepository.save(input);
	}
}
