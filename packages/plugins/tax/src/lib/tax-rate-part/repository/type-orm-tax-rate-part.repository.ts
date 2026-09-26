import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaxRatePart } from '../tax-rate-part.entity';

@Injectable()
export class TypeOrmTaxRatePartRepository extends Repository<TaxRatePart> {
	constructor(@InjectRepository(TaxRatePart) readonly repository: Repository<TaxRatePart>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
