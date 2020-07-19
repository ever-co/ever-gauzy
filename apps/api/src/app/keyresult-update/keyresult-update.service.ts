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
}
