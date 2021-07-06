import { Body, Controller, Get, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsEnum } from '@gauzy/contracts';
import { RoleService } from './role.service';
import { CrudController } from '../core/crud/crud.controller';
import { Role } from './role.entity';
import { ParseJsonPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';

@ApiTags('Role')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
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
	async findRole(
		@Query('data', ParseJsonPipe) data: any
	): Promise<Role> {
		const { findInput } = data;
		return this.roleService.findOne({ where: findInput });
	}

	@ApiOperation({ summary: 'Import role from self hosted to gauzy cloud hosted in bulk' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Role have been successfully imported.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The request body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.MIGRATE_GAUZY_CLOUD)
	@Post('import/migrate')
	async importRole(
		@Body() input: any
	) {
		return await this.roleService.migrateImportRecord(input);
	}
}
