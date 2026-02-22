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
	 * Creates or updates multiple key results in bulk (Upsert).
	 *
	 * @param {KeyResult[]} input - An array of `KeyResult` objects to be saved into the database.
	 * @returns {Promise<KeyResult[]>} - A promise resolving to the saved key results.
	 *
	 * @description
	 * This method performs a bulk save operation, which creates new entries or updates existing ones
	 * based on the primary key (upsert semantics). It delegates to the `saveMany()` helper which
	 * utilizes TypeORM's `save()` method for efficient persistence.
	 */
	async createBulk(input: KeyResult[]): Promise<KeyResult[]> {
		return await this.saveMany(input);
	}
}
