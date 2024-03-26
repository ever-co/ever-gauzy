import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureOrganization } from '../feature-organization.entity';

export class TypeOrmFeatureOrganizationRepository extends Repository<FeatureOrganization> {
    constructor(
        @InjectRepository(FeatureOrganization) readonly repository: Repository<FeatureOrganization>
    ) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
