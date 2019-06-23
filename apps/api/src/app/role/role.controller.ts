import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { RoleService } from './role.service';
import { CrudController } from '../core/crud/crud.controller';
import { Role } from './role.entity';

@ApiUseTags('Role')
@Controller()
export class RoleController extends CrudController<Role> {
    constructor(private readonly roleService: RoleService) {
        super(roleService);
    }
}
