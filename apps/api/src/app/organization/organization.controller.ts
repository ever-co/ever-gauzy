import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { Organization } from './organization.entity';
import { CrudController } from '../core/crud/crud.controller';

@ApiUseTags('Organization')
@Controller()
export class OrganizationController extends CrudController<Organization> {
    constructor(private readonly organizationService: OrganizationService) {
        super(organizationService);
    }
}