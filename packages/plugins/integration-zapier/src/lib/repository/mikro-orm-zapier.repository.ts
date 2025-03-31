import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { ZapierWebhookSubscriptionRepository } from './zapier-repository.entity';

export class MikroOrmZapierWebhookSubscriptionRepository extends MikroOrmBaseEntityRepository<ZapierWebhookSubscriptionRepository> {}
