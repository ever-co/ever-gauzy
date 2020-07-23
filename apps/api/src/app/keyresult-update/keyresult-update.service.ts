import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KeyResultUpdate } from './keyresult-update.entity';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';

@Injectable()
export class KeyResultUpdateService extends TenantAwareCrudService<
	KeyResultUpdate
> {
	constructor(
		@InjectRepository(KeyResultUpdate)
		private readonly keyResultUpdateRepository: Repository<KeyResultUpdate>
	) {
		super(keyResultUpdateRepository);
	}

	async findByKeyResultId(keyResultId: string): Promise<KeyResultUpdate[]> {
		return await this.repository
			.createQueryBuilder('key_result_update')
			.where('key_result_update.keyResultId = :keyResultId', {
				keyResultId
			})
			.getMany();
	}

	async deleteBulkByKeyResultId(ids: string[]) {
		return await this.repository.delete(ids);
	}
}
