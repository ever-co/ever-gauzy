import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';

@ApiUseTags('Organization')
@Controller()
export class OrganizationController {
    constructor(private readonly organizationService: OrganizationService) {
    }
}