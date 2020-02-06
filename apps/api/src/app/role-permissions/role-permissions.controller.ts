import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '../core';
import { CrudController } from '../core/crud/crud.controller';
import { RolePermissions } from './role-permissions.entity';
import { RolePermissionsService } from './role-permissions.service';

@ApiTags('Role')
@Controller()
export class RolePermissionsController extends CrudController<RolePermissions> {
	constructor(private readonly roleService: RolePermissionsService) {
		super(roleService);
	}

	@ApiOperation({ summary: 'Find role.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found role',
		type: RolePermissions
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findRole(
		@Query('data') data: string
	): Promise<IPagination<RolePermissions>> {
		const { findInput } = JSON.parse(data);

		return this.roleService.findAll({ where: findInput });
	}
}
