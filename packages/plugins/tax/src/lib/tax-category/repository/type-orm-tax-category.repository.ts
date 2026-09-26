import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaxCategory } from '../tax-category.entity';

@Injectable()
export class TypeOrmTaxCategoryRepository extends Repository<TaxCategory> {
	constructor(@InjectRepository(TaxCategory) readonly repository: Repository<TaxCategory>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
