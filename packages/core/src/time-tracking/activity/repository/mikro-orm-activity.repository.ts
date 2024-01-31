import { EntityRepository } from '@mikro-orm/core';
import { Activity } from '../activity.entity';

export class MikroOrmActivityRepository extends EntityRepository<Activity> { }