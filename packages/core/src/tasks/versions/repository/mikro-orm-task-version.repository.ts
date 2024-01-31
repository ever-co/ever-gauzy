import { EntityRepository } from '@mikro-orm/core';
import { TaskVersion } from '../version.entity';

export class MikroOrmTaskVersionRepository extends EntityRepository<TaskVersion> { }
