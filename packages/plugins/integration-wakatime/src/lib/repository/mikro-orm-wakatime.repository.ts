import { EntityRepository } from '@mikro-orm/knex';
import { Wakatime } from '../wakatime.entity';

export class MikroOrmWakatimeRepository extends EntityRepository<Wakatime> { }
