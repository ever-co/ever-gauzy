import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaxLine } from '../tax-line.entity';

@Injectable()
export class TypeOrmTaxLineRepository extends Repository<TaxLine> {
	constructor(@InjectRepository(TaxLine) readonly repository: Repository<TaxLine>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
