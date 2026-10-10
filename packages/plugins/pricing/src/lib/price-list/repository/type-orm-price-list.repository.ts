import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceList } from '../price-list.entity';

@Injectable()
export class TypeOrmPriceListRepository extends Repository<PriceList> {
	constructor(@InjectRepository(PriceList) readonly repository: Repository<PriceList>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
