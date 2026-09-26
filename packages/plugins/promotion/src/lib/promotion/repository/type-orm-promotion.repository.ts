import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promotion } from '../promotion.entity';

/**
 * TypeORM repository of Promotion. It exists so that providers depend on a repository of this
 * package rather than on a bare \`Repository<Promotion>\`, which is what lets the service inject a
 * single class under both ORMs.
 */
@Injectable()
export class TypeOrmPromotionRepository extends Repository<Promotion> {
	constructor(@InjectRepository(Promotion) readonly repository: Repository<Promotion>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
