import {
	IPagination,
	IRolePermission,
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
	UseGuards,
	ValidationPipe
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UpdateResult } from 'typeorm';
import { CrudController } from './../core/crud';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { CreateRolePermissionDTO, UpdateRolePermissionDTO } from './dto';
import { RolePermission } from './role-permission.entity';
import { RolePermissionService } from './role-permission.service';

@ApiTags('Role')
@UseGuards(TenantPermissionGuard)
@Controller()
export class RolePermissionController extends CrudController<RolePermission> {
	constructor(
		private readonly rolePermissionService: RolePermissionService
	) {
		super(rolePermissionService);
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
		return await this.rolePermissionService.migrateImportRecord(input);
	}

	@ApiOperation({ summary: 'Find role permissions.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found role permissions.',
		type: RolePermission
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	@HttpCode(HttpStatus.OK)
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IRolePermission>> {
		const { findInput } = data;
		return this.rolePermissionService.findAllRolePermissions({ where: findInput });
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
		@Body(new ValidationPipe({
			transform: true,
			whitelist: true
		})) entity: CreateRolePermissionDTO
	): Promise<IRolePermission> {
		return this.rolePermissionService.createPermission(entity);
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
		@Body(new ValidationPipe({
			transform: true,
			whitelist: true
		})) entity: UpdateRolePermissionDTO
	): Promise<UpdateResult | IRolePermission> {
		return await this.rolePermissionService.updatePermission(id, entity);
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.CHANGE_ROLES_PERMISSIONS)
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<any> {
		return await this.rolePermissionService.deletePermission(id);
	}
}