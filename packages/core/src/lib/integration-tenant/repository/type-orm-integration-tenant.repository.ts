import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationTenant } from '../integration-tenant.entity';

@Injectable()
export class TypeOrmIntegrationTenantRepository extends Repository<IntegrationTenant> {
    constructor(@InjectRepository(IntegrationTenant) readonly repository: Repository<IntegrationTenant>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
