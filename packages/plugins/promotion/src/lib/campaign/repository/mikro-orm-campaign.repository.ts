import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { Campaign } from '../campaign.entity';

/**
 * MikroORM repository of Campaign. The base class supplies the entity-manager-backed operations
 * the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmCampaignRepository extends MikroOrmBaseEntityRepository<Campaign> {}
