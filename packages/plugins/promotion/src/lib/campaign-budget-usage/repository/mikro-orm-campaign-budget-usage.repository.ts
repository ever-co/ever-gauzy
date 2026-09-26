import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { CampaignBudgetUsage } from '../campaign-budget-usage.entity';

/**
 * MikroORM repository of CampaignBudgetUsage. The base class supplies the entity-manager-backed operations
 * the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmCampaignBudgetUsageRepository extends MikroOrmBaseEntityRepository<CampaignBudgetUsage> {}
