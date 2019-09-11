import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationVendorsService } from './organization-vendors.service';
import { OrganizationVendors } from './organization-vendors.entity';

@ApiUseTags('Organization-Vendors')
@Controller()
export class OrganizationVendorsController extends CrudController<OrganizationVendors> {
    constructor(private readonly organizationVendorsService: OrganizationVendorsService) {
        super(organizationVendorsService);
    }
}