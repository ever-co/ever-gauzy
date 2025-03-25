import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { ZapierWebhookSubscription } from './zapier-repository.entity';

export class MikroOrmZapierWebhookSubscriptionRepository extends MikroOrmBaseEntityRepository<ZapierWebhookSubscription> {}
