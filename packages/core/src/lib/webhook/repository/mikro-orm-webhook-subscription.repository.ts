import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { WebhookSubscription } from '../webhook-subscription.entity';

export class MikroOrmWebhookSubscriptionRepository extends MikroOrmBaseEntityRepository<WebhookSubscription> {}
