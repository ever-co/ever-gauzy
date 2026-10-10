import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromotionUsage } from '../promotion-usage.entity';

/**
 * TypeORM repository of PromotionUsage. It exists so that providers depend on a repository of this
 * package rather than on a bare \`Repository<PromotionUsage>\`, which is what lets the service inject a
 * single class under both ORMs.
 */
@Injectable()
export class TypeOrmPromotionUsageRepository extends Repository<PromotionUsage> {
	constructor(@InjectRepository(PromotionUsage) readonly repository: Repository<PromotionUsage>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
