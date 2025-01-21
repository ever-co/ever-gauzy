import { Injectable } from '@nestjs/common';
import { KeyResult } from './keyresult.entity';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmKeyResultRepository } from './repository/type-orm-keyresult.repository';
import { MikroOrmKeyResultRepository } from './repository/mikro-orm-keyresult.repository';

@Injectable()
export class KeyResultService extends TenantAwareCrudService<KeyResult> {
	constructor(
		typeOrmKeyResultRepository: TypeOrmKeyResultRepository,
		mikroOrmKeyResultRepository: MikroOrmKeyResultRepository
	) {
		super(typeOrmKeyResultRepository, mikroOrmKeyResultRepository);
	}

	/**
	 * Creates multiple key results in bulk.
	 *
	 * @param {KeyResult[]} input - An array of `KeyResult` objects to be inserted into the database.
	 * @returns {Promise<KeyResult[]>} - A promise resolving to the newly created key results.
	 *
	 * @description
	 * This method performs a bulk insert operation, saving multiple key result entries at once.
	 * It utilizes TypeORM's `save()` method to persist the provided key results efficiently.
	 */
	async createBulk(input: KeyResult[]): Promise<KeyResult[]> {
		return this.typeOrmRepository.save(input);
	}
}
