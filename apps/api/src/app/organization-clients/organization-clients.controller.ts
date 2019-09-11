import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationClientsService } from './organization-clients.service';
import { OrganizationClients } from './organization-clients.entity';

@ApiUseTags('Organization-Clients')
@Controller()
export class OrganizationClientsController extends CrudController<OrganizationClients> {
    constructor(private readonly organizationClientsService: OrganizationClientsService) {
        super(organizationClientsService);
    }
}