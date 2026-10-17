import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnitCategory } from '../unit-category.entity';

@Injectable()
export class TypeOrmUnitCategoryRepository extends Repository<UnitCategory> {
	constructor(@InjectRepository(UnitCategory) readonly repository: Repository<UnitCategory>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
