import { Repository } from 'typeorm';
import { IntegrationMap } from '../integration-map.entity';

export class TypeOrmIntegrationMapRepository extends Repository<IntegrationMap> { }