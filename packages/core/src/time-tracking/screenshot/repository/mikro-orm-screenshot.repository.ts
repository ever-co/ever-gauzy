import { EntityRepository } from '@mikro-orm/core';
import { Screenshot } from '../screenshot.entity';

export class MikroOrmScreenshotRepository extends EntityRepository<Screenshot> { }