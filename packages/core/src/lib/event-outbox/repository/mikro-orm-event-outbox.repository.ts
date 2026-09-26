import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { EventOutbox } from '../event-outbox.entity';

export class MikroOrmEventOutboxRepository extends MikroOrmBaseEntityRepository<EventOutbox> {}
