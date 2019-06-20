import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { RoleService } from './role.service';

@ApiUseTags('Role')
@Controller()
export class RoleController {
    constructor(private readonly roleService: RoleService) {
    }
}
