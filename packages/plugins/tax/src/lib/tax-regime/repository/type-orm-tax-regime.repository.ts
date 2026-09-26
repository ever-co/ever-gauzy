import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaxRegime } from '../tax-regime.entity';

@Injectable()
export class TypeOrmTaxRegimeRepository extends Repository<TaxRegime> {
	constructor(@InjectRepository(TaxRegime) readonly repository: Repository<TaxRegime>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
