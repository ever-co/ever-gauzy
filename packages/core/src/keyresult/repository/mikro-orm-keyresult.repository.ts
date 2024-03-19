import { EntityRepository } from '@mikro-orm/knex';
import { KeyResult } from '../keyresult.entity';

export class MikroOrmKeyResultRepository extends EntityRepository<KeyResult> { }
