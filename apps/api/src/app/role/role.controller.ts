import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RoleService } from './role.service';
import { CrudController } from '../core/crud/crud.controller';
import { Role } from './role.entity';

@ApiUseTags('Role')
@Controller()
export class RoleController extends CrudController<Role> {
    constructor(private readonly roleService: RoleService) {
        super(roleService);
    }

    @ApiOperation({ title: 'Find role.' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Found role', type: Role })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
    @Get()
    async findRole(@Query('data') data: string): Promise<Role> {
        const { findInput } = JSON.parse(data);

        return this.roleService.findOne({ where: findInput });
    }
}
