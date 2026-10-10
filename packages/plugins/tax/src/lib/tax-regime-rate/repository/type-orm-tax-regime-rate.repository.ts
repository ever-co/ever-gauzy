import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaxRegimeRate } from '../tax-regime-rate.entity';

@Injectable()
export class TypeOrmTaxRegimeRateRepository extends Repository<TaxRegimeRate> {
	constructor(@InjectRepository(TaxRegimeRate) readonly repository: Repository<TaxRegimeRate>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
