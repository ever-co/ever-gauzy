import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { ZapierWebhookSubscription } from '../zapier-webhook-subscription.entity';

export class MikroOrmZapierWebhookSubscriptionRepository extends MikroOrmBaseEntityRepository<ZapierWebhookSubscription> { }
