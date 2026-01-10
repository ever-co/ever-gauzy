import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PluginBilling } from '../entities/plugin-billing.entity';

export class MikroOrmPluginBillingRepository extends MikroOrmBaseEntityRepository<PluginBilling> {}
