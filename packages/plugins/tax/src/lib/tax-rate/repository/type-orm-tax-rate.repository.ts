import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaxRate } from '../tax-rate.entity';

@Injectable()
export class TypeOrmTaxRateRepository extends Repository<TaxRate> {
	constructor(@InjectRepository(TaxRate) readonly repository: Repository<TaxRate>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
