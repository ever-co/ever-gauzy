import { Repository } from 'typeorm';
import { FeatureOrganization } from '../feature-organization.entity';

export class TypeOrmFeatureOrganizationRepository extends Repository<FeatureOrganization> { }
