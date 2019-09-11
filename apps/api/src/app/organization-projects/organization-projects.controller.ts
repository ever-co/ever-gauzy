import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationProjectsService } from './organization-projects.service';
import { OrganizationProjects } from './organization-projects.entity';

@ApiUseTags('Organization-Projects')
@Controller()
export class OrganizationProjectsController extends CrudController<OrganizationProjects> {
    constructor(private readonly organizationProjectsService: OrganizationProjectsService) {
        super(organizationProjectsService);
    }
}