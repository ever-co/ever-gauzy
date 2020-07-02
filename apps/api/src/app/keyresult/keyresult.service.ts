import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KeyResult } from './keyresult.entity';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';

@Injectable()
export class KeyResultService extends TenantAwareCrudService<KeyResult> {
	constructor(
		@InjectRepository(KeyResult)
		private readonly keyResultRepository: Repository<KeyResult>
	) {
		super(keyResultRepository);
	}
}
