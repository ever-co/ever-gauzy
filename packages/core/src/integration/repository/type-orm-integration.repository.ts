import { Repository } from 'typeorm';
import { Integration } from '../integration.entity';

export class TypeOrmIntegrationRepository extends Repository<Integration> { }