import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Feature } from '../feature.entity';

export class MikroOrmFeatureRepository extends MikroOrmBaseEntityRepository<Feature> { }
