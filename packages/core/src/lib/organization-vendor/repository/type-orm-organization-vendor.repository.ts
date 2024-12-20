import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationVendor } from '../organization-vendor.entity';

@Injectable()
export class TypeOrmOrganizationVendorRepository extends Repository<OrganizationVendor> {
    constructor(@InjectRepository(OrganizationVendor) readonly repository: Repository<OrganizationVendor>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
