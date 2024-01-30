import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { Deal } from './deal.entity';
import { TypeOrmDealRepository } from './repository/type-orm-deal.repository';
import { MikroOrmDealRepository } from './repository/mikro-orm-deal.repository';

@Injectable()
export class DealService extends TenantAwareCrudService<Deal> {
	constructor(
		@InjectRepository(Deal)
		typeOrmDealRepository: TypeOrmDealRepository,

		mikroOrmDealRepository: MikroOrmDealRepository
	) {
		super(typeOrmDealRepository, mikroOrmDealRepository);
	}
}
