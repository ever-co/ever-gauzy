import { EntityRepository } from '@mikro-orm/core';
import { Feature } from '../feature.entity';

export class MikroOrmFeatureRepository extends EntityRepository<Feature> { }