import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { KeyResultUpdate } from './keyresult-update.entity';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmKeyResultUpdateRepository } from './repository/type-orm-keyresult-update.repository';
import { MikroOrmKeyResultUpdateRepository } from './repository/mikro-orm-keyresult-update.repository';

@Injectable()
export class KeyResultUpdateService extends TenantAwareCrudService<KeyResultUpdate> {
	constructor(
		@InjectRepository(KeyResultUpdate)
		typeOrmKeyResultUpdateRepository: TypeOrmKeyResultUpdateRepository,

		mikroOrmKeyResultUpdateRepository: MikroOrmKeyResultUpdateRepository
	) {
		super(typeOrmKeyResultUpdateRepository, mikroOrmKeyResultUpdateRepository);
	}

	/**
	 *
	 * @param keyResultId
	 * @returns
	 */
	async findByKeyResultId(keyResultId: string): Promise<KeyResultUpdate[]> {
		return await this.typeOrmRepository
			.createQueryBuilder('key_result_update')
			.where('key_result_update.keyResultId = :keyResultId', {
				keyResultId
			})
			.getMany();
	}

	/**
	 *
	 * @param ids
	 * @returns
	 */
	async deleteBulkByKeyResultId(ids: string[]) {
		return await this.typeOrmRepository.delete(ids);
	}
}
