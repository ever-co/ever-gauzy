import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RoleService } from './role.service';
import { CrudController } from '../core/crud/crud.controller';
import { Role } from './role.entity';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Role')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class RoleController extends CrudController<Role> {
	constructor(private readonly roleService: RoleService) {
		super(roleService);
	}

	@ApiOperation({ summary: 'Find role.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found role',
		type: Role
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findRole(@Query('data') data: string): Promise<Role> {
		const { findInput } = JSON.parse(data);

		return this.roleService.findOne({ where: findInput });
	}
}
