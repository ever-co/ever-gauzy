import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { Deal } from './deal.entity';
import { TypeOrmDealRepository } from './repository/type-orm-deal.repository';
import { MikroOrmDealRepository } from './repository/mikro-orm-deal.repository';

@Injectable()
export class DealService extends TenantAwareCrudService<Deal> {
	constructor(
		readonly typeOrmDealRepository: TypeOrmDealRepository,
		readonly mikroOrmDealRepository: MikroOrmDealRepository
	) {
		super(typeOrmDealRepository, mikroOrmDealRepository);
	}
}
