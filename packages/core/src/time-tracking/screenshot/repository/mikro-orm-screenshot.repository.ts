import { EntityRepository } from '@mikro-orm/knex';
import { Screenshot } from '../screenshot.entity';

export class MikroOrmScreenshotRepository extends EntityRepository<Screenshot> { }
