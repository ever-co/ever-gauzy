import { TenantAwareCrudService } from './../core/crud';
import { Deal } from './deal.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';

@Injectable()
export class DealService extends TenantAwareCrudService<Deal> {
	public constructor(
		@InjectRepository(Deal)
		dealRepository: Repository<Deal>,
		@MikroInjectRepository(Deal)
		mikroDealRepository: EntityRepository<Deal>
	) {
		super(dealRepository, mikroDealRepository);
	}
}
