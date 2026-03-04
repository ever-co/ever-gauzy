import { Injectable } from '@nestjs/common';

import { ID } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { MultiORMEnum } from './../core/utils';
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
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const items = await this.mikroOrmRepository.find({ keyResultId } as any);
				return items.map((e) => this.serialize(e)) as KeyResultUpdate[];
			}
			case MultiORMEnum.TypeORM:
			default:
				return await this.typeOrmRepository
					.createQueryBuilder('key_result_update')
					.where('key_result_update.keyResultId = :keyResultId', {
						keyResultId
					})
					.getMany();
		}
	}
}
