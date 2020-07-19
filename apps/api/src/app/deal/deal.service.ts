import { Injectable } from '@angular/core';
import { CrudService } from '../core/crud';
import { Deal } from './deal.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class DealService extends CrudService<Deal> {
	public constructor(
		@InjectRepository(Deal)
		dealRepository: Repository<Deal>
	) {
		super(dealRepository);
	}
}
