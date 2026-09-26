import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignBudget } from '../campaign-budget.entity';

/**
 * TypeORM repository of CampaignBudget. It exists so that providers depend on a repository of this
 * package rather than on a bare \`Repository<CampaignBudget>\`, which is what lets the service inject a
 * single class under both ORMs.
 */
@Injectable()
export class TypeOrmCampaignBudgetRepository extends Repository<CampaignBudget> {
	constructor(@InjectRepository(CampaignBudget) readonly repository: Repository<CampaignBudget>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
