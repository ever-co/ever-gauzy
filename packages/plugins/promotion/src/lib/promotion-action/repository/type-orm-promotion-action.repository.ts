import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromotionAction } from '../promotion-action.entity';

/**
 * TypeORM repository of PromotionAction. It exists so that providers depend on a repository of this
 * package rather than on a bare \`Repository<PromotionAction>\`, which is what lets the service inject a
 * single class under both ORMs.
 */
@Injectable()
export class TypeOrmPromotionActionRepository extends Repository<PromotionAction> {
	constructor(@InjectRepository(PromotionAction) readonly repository: Repository<PromotionAction>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
