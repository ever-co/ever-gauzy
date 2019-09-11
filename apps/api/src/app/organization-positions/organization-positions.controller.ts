import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { OrganizationPositionsService } from './organization-positions.service';
import { OrganizationPositions } from './organization-positions.entity';

@ApiUseTags('Organization-Positions')
@Controller()
export class OrganizationPositionsController extends CrudController<OrganizationPositions> {
    constructor(private readonly organizationPositionsService: OrganizationPositionsService) {
        super(organizationPositionsService);
    }
}