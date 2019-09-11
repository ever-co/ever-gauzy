import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { OrganizationVendors } from './organization-vendors.entity';

@Injectable()
export class OrganizationVendorsService extends CrudService<OrganizationVendors> {
    constructor(
        @InjectRepository(OrganizationVendors) private readonly organizationVendorsRepository: Repository<OrganizationVendors>
    ) {
        super(organizationVendorsRepository);
    }
}
