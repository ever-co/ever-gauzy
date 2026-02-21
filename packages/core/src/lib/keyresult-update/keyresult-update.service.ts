import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmKeyResultUpdateRepository } from './repository/type-orm-keyresult-update.repository';
import { MikroOrmKeyResultUpdateRepository } from './repository/mikro-orm-keyresult-update.repository';
import { KeyResultUpdate } from './keyresult-update.entity';

@Injectable()
export class KeyResultUpdateService extends TenantAwareCrudService<KeyResultUpdate> {
	constructor(
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
	async findByKeyResultId(keyResultId: ID): Promise<KeyResultUpdate[]> {
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
		if (ids.length > 0) {
			await this.delete({ id: In(ids) } as any);
		}
	}
}
