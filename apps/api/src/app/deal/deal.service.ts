import { Injectable } from '@angular/core';
import { TenantAwareCrudService } from '../core/crud';
import { Deal } from './deal.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class DealService extends TenantAwareCrudService<Deal> {
	public constructor(
		@InjectRepository(Deal)
		dealRepository: Repository<Deal>
	) {
		super(dealRepository);
	}
}
