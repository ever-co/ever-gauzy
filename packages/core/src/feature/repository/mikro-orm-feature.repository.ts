import { EntityRepository } from '@mikro-orm/knex';
import { Feature } from '../feature.entity';

export class MikroOrmFeatureRepository extends EntityRepository<Feature> { }
