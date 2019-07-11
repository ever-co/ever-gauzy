import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { UserOrganization } from '@gauzy/models';
import { UserOrganizationService } from './user-organization.services';

@ApiUseTags('UserOrganization')
@Controller()
export class UserOrganizationController extends CrudController<UserOrganization> {
    constructor(private readonly userOrganizationService: UserOrganizationService) {
        super(userOrganizationService);
    }
}
