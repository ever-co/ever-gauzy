import {
	IPagination,
	IRolePermission,
	IRolePermissionCreateInput,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UpdateResult } from 'typeorm';
import { CrudController } from './../core/crud';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { RolePermissions } from './role-permissions.entity';
import { RolePermissionsService } from './role-permissions.service';

@ApiTags('Role')
@UseGuards(TenantPermissionGuard)
@Controller()
export class RolePermissionsController extends CrudController<RolePermissions> {
	constructor(
		private readonly rolePermissionsService: RolePermissionsService
	) {
		super(rolePermissionsService);
	}

	@ApiOperation({ summary: 'Import role-permissions from self hosted to gauzy cloud hosted in bulk' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Role Permissions have been successfully imported.'
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
		return await this.rolePermissionsService.migrateImportRecord(input);
	}

	@ApiOperation({ summary: 'Find role permissions.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found role permissions.',
		type: RolePermissions
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IRolePermission>> {
		const { findInput } = data;
		return this.rolePermissionsService.findAll({ where: findInput });
	}

	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	async create(
		@Body() entity: IRolePermissionCreateInput
	): Promise<IRolePermission> {
		return this.rolePermissionsService.create(entity);
	}

	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: RolePermissions
	): Promise<UpdateResult | IRolePermission> {
		return await this.rolePermissionsService.updatePermission(id, entity);
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<any> {
		return await this.rolePermissionsService.deletePermission(id);
	}
}