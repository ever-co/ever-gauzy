import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Subscription } from '../subscription.entity';

export class MikroOrmSubscriptionRepository extends MikroOrmBaseEntityRepository<Subscription> {}
