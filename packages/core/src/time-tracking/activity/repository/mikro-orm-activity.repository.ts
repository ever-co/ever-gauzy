import { EntityRepository } from '@mikro-orm/knex';
import { Activity } from '../activity.entity';

export class MikroOrmActivityRepository extends EntityRepository<Activity> { }
