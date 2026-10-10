import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { WebhookDelivery } from '../webhook-delivery.entity';

export class MikroOrmWebhookDeliveryRepository extends MikroOrmBaseEntityRepository<WebhookDelivery> {}
