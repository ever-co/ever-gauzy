import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PluginSubscriptionPlan } from '../entities/plugin-subscription-plan.entity';

export class MikroOrmPluginSubscriptionPlanRepository extends MikroOrmBaseEntityRepository<PluginSubscriptionPlan> {}
