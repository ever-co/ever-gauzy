import { Repository } from 'typeorm';
import { Feature } from '../feature.entity';

export class TypeOrmFeatureRepository extends Repository<Feature> { }