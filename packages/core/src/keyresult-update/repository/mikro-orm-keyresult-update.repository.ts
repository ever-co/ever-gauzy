import { EntityRepository } from '@mikro-orm/knex';
import { KeyResultUpdate } from '../keyresult-update.entity';

export class MikroOrmKeyResultUpdateRepository extends EntityRepository<KeyResultUpdate> { }
