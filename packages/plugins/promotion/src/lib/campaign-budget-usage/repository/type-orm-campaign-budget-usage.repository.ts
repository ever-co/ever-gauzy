import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignBudgetUsage } from '../campaign-budget-usage.entity';

/**
 * TypeORM repository of CampaignBudgetUsage. It exists so that providers depend on a repository of this
 * package rather than on a bare \`Repository<CampaignBudgetUsage>\`, which is what lets the service inject a
 * single class under both ORMs.
 */
@Injectable()
export class TypeOrmCampaignBudgetUsageRepository extends Repository<CampaignBudgetUsage> {
	constructor(@InjectRepository(CampaignBudgetUsage) readonly repository: Repository<CampaignBudgetUsage>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
