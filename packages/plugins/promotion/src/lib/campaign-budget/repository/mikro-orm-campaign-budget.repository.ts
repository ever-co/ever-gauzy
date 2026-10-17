import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { CampaignBudget } from '../campaign-budget.entity';

/**
 * MikroORM repository of CampaignBudget. The base class supplies the entity-manager-backed operations
 * the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmCampaignBudgetRepository extends MikroOrmBaseEntityRepository<CampaignBudget> {}
